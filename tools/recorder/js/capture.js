/* 화면 잡기 · 영역 잘라내기 · 소리 섞기 · 녹화.
 *
 * 브라우저가 화면과 "컴퓨터에서 나는 소리"를 함께 내어 줄 수 있다는 점을 그대로 쓴다.
 * (이게 핵심이다 — 따로 가상 녹음 장치를 깔지 않아도 영상 소리가 그대로 들어간다)
 *
 * 흐름
 *   ① getDisplayMedia 로 화면 한 장 통째로 잡는다
 *   ② 고른 네모만 잘라 새 영상 트랙을 만든다   ← 여기가 "영역 녹화"
 *   ③ 컴퓨터 소리 + 마이크를 섞어 소리 트랙 하나로 만든다
 *   ④ 둘을 묶어 MediaRecorder 에 넣고, 나오는 조각을 곧바로 서버에 넘겨 파일로 쌓는다
 *
 * 화면을 잘라내는 방법은 두 가지를 준비했다.
 *   ㉠ MediaStreamTrackProcessor (요즘 크롬·엣지) — 창을 내려놔도 계속 돈다. 이쪽이 기본.
 *   ㉡ 캔버스에 그려서 잡기          — 어디서나 되지만, 창을 내려놓으면 느려질 수 있다.
 */
window.Capture = (function () {
  'use strict';

  const S = window.Shared;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const state = {
    stream: null,          // 화면 원본 (영상 + 컴퓨터 소리)
    videoTrack: null,
    sourceInfo: null,      // {w,h,fps,surface,hasAudio,label}
    micStream: null,

    audioCtx: null,
    mixDest: null,
    sysGain: null,
    micGain: null,
    sysMeter: null,
    micMeter: null,

    crop: null,            // 지금 도는 잘라내기 {track, stop, mode}
    recorder: null,
    upload: null,
    onEnded: null,         // 사용자가 브라우저 "공유 중지" 를 눌렀을 때
  };

  /* ── 이 브라우저로 되는가 ────────────────────────────────────────── */

  function support() {
    const md = navigator.mediaDevices;
    const ua = navigator.userAgent;
    const chromium = /Chrome\/|Edg\//.test(ua) && !/Firefox/.test(ua);
    return {
      display: !!(md && md.getDisplayMedia),
      recorder: typeof window.MediaRecorder !== 'undefined',
      insertable: !!(window.MediaStreamTrackProcessor && window.MediaStreamTrackGenerator && window.VideoFrame),
      chromium,
      mp4: typeof window.MediaRecorder !== 'undefined' && !!pickMime('mp4', true),
      webm: typeof window.MediaRecorder !== 'undefined' && !!pickMime('webm', true),
      secure: window.isSecureContext,
    };
  }

  /** 이 브라우저가 받아 주는 저장 형식 하나 고르기 */
  function pickMime(prefer, hasAudio) {
    if (typeof window.MediaRecorder === 'undefined') return '';
    const a = hasAudio ? ',mp4a.40.2' : '';
    const mp4 = [
      'video/mp4;codecs=avc1.640034' + a,
      'video/mp4;codecs=avc1.640028' + a,
      'video/mp4;codecs=avc1.42E034' + a,
      'video/mp4;codecs=avc1' + a,
      hasAudio ? 'video/mp4;codecs=h264,aac' : 'video/mp4;codecs=h264',
      'video/mp4',
    ];
    const webm = [
      hasAudio ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp9',
      hasAudio ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8',
      'video/webm',
    ];
    const order = prefer === 'webm' ? webm.concat(mp4) : mp4.concat(webm);
    for (const t of order) {
      try { if (window.MediaRecorder.isTypeSupported(t)) return t; } catch (_) {}
    }
    return '';
  }

  function extOf(mime) { return /mp4/.test(mime) ? 'mp4' : 'webm'; }

  /* ── ① 화면 잡기 ────────────────────────────────────────────────── */

  async function grab(opts) {
    release();
    const o = opts || {};
    const want = {
      video: {
        frameRate: { ideal: o.fps || 60, max: Math.max(30, o.fps || 60) },
        displaySurface: 'monitor',
      },
      audio: o.systemAudio ? {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
      } : false,
      systemAudio: o.systemAudio ? 'include' : 'exclude',
      selfBrowserSurface: 'exclude',   // 이 창 자신은 목록에 안 나오게
      surfaceSwitching: 'exclude',
      monitorTypeSurfaces: 'include',
      preferCurrentTab: false,
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia(want);
    } catch (e) {
      /* 옛 브라우저는 낯선 항목을 보면 통째로 거절한다 — 간단한 요청으로 한 번 더 */
      if (e && (e.name === 'TypeError' || e.name === 'NotSupportedError')) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: o.fps || 60 } },
          audio: !!o.systemAudio,
        });
      } else {
        throw e;
      }
    }

    state.stream = stream;
    state.videoTrack = stream.getVideoTracks()[0];
    if (!state.videoTrack) { release(); throw new Error('영상 트랙을 받지 못했습니다.'); }

    /* 될 수 있으면 원본 해상도·초당 장수를 그대로 받아 온다 */
    try {
      await state.videoTrack.applyConstraints({
        frameRate: { ideal: o.fps || 60 },
        width: { ideal: 7680 },
        height: { ideal: 4320 },
        resizeMode: 'none',
      });
    } catch (_) { /* 못 받아 주면 원래 값 그대로 쓴다 */ }

    state.videoTrack.addEventListener('ended', () => {
      if (state.onEnded) { try { state.onEnded(); } catch (_) {} }
    });

    const info = await describe(state.videoTrack, stream);
    if (!(info.w >= 16) || !(info.h >= 16)) {
      release();
      throw new Error('잡아 온 화면의 크기를 알 수 없습니다. 화면 잡기를 다시 해 주세요.');
    }
    state.sourceInfo = info;
    return info;
  }

  /** 잡은 화면이 얼마나 큰지·소리는 있는지 알아본다 */
  async function describe(track, stream) {
    const st = (track.getSettings && track.getSettings()) || {};
    let w = st.width || 0;
    let h = st.height || 0;

    /* 트랙이 크기를 안 알려 주는 경우가 있어, 실제 그림으로 한 번 더 확인한다 */
    if (!w || !h) {
      const v = document.createElement('video');
      v.muted = true;
      v.srcObject = new MediaStream([track]);
      try {
        await v.play();
        for (let i = 0; i < 40 && !v.videoWidth; i++) await sleep(50);
        w = v.videoWidth; h = v.videoHeight;
      } catch (_) {}
      try { v.pause(); v.srcObject = null; } catch (_) {}
    }

    const audio = stream.getAudioTracks();
    return {
      w: w || 0,
      h: h || 0,
      fps: Math.round(st.frameRate || 0),
      surface: st.displaySurface || '',
      label: track.label || '',
      hasAudio: audio.length > 0,
      audioLabel: audio.length ? (audio[0].label || '컴퓨터 소리') : '',
    };
  }

  function onEnded(fn) { state.onEnded = fn; }

  function sourceInfo() { return state.sourceInfo; }
  function videoTrack() { return state.videoTrack; }

  /** 미리 보기용 — 소리는 뺀 영상만 */
  function previewStream() {
    if (!state.videoTrack) return null;
    return new MediaStream([state.videoTrack]);
  }

  function release() {
    stopCrop();
    if (state.stream) {
      for (const t of state.stream.getTracks()) { try { t.stop(); } catch (_) {} }
    }
    state.stream = null;
    state.videoTrack = null;
    state.sourceInfo = null;
    stopMic();
    closeAudio();
  }

  /* ── ② 영역 잘라내기 ────────────────────────────────────────────── */

  /**
   * 고른 네모만 담은 새 영상 트랙을 만든다.
   *   rect : 그림 좌표의 {x,y,w,h}
   *   out  : 저장할 크기 {w,h}
   * 네모가 화면 전체이고 크기도 그대로면 잘라내지 않고 원본을 그대로 쓴다(제일 깨끗하다).
   */
  function startCrop(rect, out, fps) {
    stopCrop();
    const src = state.videoTrack;
    if (!src) throw new Error('먼저 화면을 잡아 주세요.');
    const info = state.sourceInfo || { w: 0, h: 0 };

    const whole = rect.x === 0 && rect.y === 0 && rect.w === info.w && rect.h === info.h
      && out.w === info.w && out.h === info.h;
    if (whole) {
      state.crop = { track: src, stop: function () {}, mode: 'direct' };
      return state.crop;
    }

    if (window.MediaStreamTrackProcessor && window.MediaStreamTrackGenerator && window.VideoFrame) {
      state.crop = cropByFrames(src, rect, out);
      return state.crop;
    }
    state.crop = cropByCanvas(src, rect, out, fps);
    return state.crop;
  }

  /** ㉠ 프레임을 하나씩 받아 잘라내기 — 창을 내려놔도 계속 돈다 */
  function cropByFrames(src, rect, out) {
    const processor = new MediaStreamTrackProcessor({ track: src });
    const generator = new MediaStreamTrackGenerator({ kind: 'video' });
    const reader = processor.readable.getReader();
    const writer = generator.writable.getWriter();

    const canvas = new OffscreenCanvas(out.w, out.h);
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    ctx.imageSmoothingQuality = 'high';

    let stopped = false;
    let dropped = 0;
    let drawn = 0;

    /* 프레임은 반드시 close() 해야 한다 — 안 하면 디코더가 막혀 화면이 뚝뚝 끊긴다.
     * 그래서 어느 길로 빠져나가든 닫히도록 해 두었다. */
    const finished = (async function pump() {
      while (!stopped) {
        let r;
        try { r = await reader.read(); }
        catch (_) { break; }
        if (!r || r.done) break;
        const frame = r.value;
        try {
          ctx.drawImage(frame, rect.x, rect.y, rect.w, rect.h, 0, 0, out.w, out.h);
          const next = new VideoFrame(canvas, {
            timestamp: frame.timestamp,
            duration: frame.duration || undefined,
            alpha: 'discard',
          });
          if (stopped) {
            try { next.close(); } catch (_) {}
          } else {
            try { await writer.write(next); drawn++; }
            catch (_) { try { next.close(); } catch (_) {} stopped = true; }
          }
        } catch (_) {
          dropped++;
        }
        try { frame.close(); } catch (_) {}
      }
      try { await writer.close(); } catch (_) {}
      try { reader.cancel(); } catch (_) {}
    }());

    return {
      track: generator,
      mode: 'frames',
      stats: function () { return { drawn: drawn, dropped: dropped }; },
      stop: function () {
        stopped = true;
        try { reader.cancel(); } catch (_) {}
        /* 흘러가던 프레임을 다 닫은 뒤에 트랙을 끊는다.
         * 먼저 끊으면 대기 중이던 프레임이 닫히지 못한 채 버려진다. */
        const bye = function () { try { generator.stop(); } catch (_) {} };
        finished.then(bye, bye);
        setTimeout(bye, 1500);
      },
    };
  }

  /** ㉡ 캔버스에 그려서 잘라내기 — 어디서나 되지만 창을 내려놓으면 느려질 수 있다 */
  function cropByCanvas(src, rect, out, fps) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([src]);
    video.play().catch(() => {});

    const canvas = document.createElement('canvas');
    canvas.width = out.w;
    canvas.height = out.h;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    ctx.imageSmoothingQuality = 'high';

    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];

    let stopped = false;
    let drawn = 0;
    let timer = null;

    function draw() {
      if (stopped) return;
      try {
        if (video.videoWidth) {
          ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h, 0, 0, out.w, out.h);
          if (track.requestFrame) track.requestFrame();
          drawn++;
        }
      } catch (_) {}
    }

    if (video.requestVideoFrameCallback) {
      const step = function () {
        if (stopped) return;
        draw();
        try { video.requestVideoFrameCallback(step); } catch (_) {}
      };
      try { video.requestVideoFrameCallback(step); } catch (_) {}
      /* 창을 내려놓으면 위 신호가 끊기므로, 느리게라도 계속 그리는 예비 시계를 둔다 */
      timer = setInterval(draw, Math.max(100, Math.round(1000 / Math.max(1, fps || 30))));
    } else {
      timer = setInterval(draw, Math.max(16, Math.round(1000 / Math.max(1, fps || 30))));
    }

    return {
      track: track,
      mode: 'canvas',
      stats: function () { return { drawn: drawn, dropped: 0 }; },
      stop: function () {
        stopped = true;
        if (timer) clearInterval(timer);
        try { track.stop(); } catch (_) {}
        try { video.pause(); video.srcObject = null; } catch (_) {}
      },
    };
  }

  function stopCrop() {
    if (state.crop) { try { state.crop.stop(); } catch (_) {} }
    state.crop = null;
  }

  /* ── ③ 소리 섞기 ───────────────────────────────────────────────── */

  async function listMics() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter((d) => d.kind === 'audioinput')
        .map((d) => ({ id: d.deviceId, label: d.label || '마이크' }));
    } catch (_) { return []; }
  }

  async function startMic(deviceId) {
    stopMic();
    const want = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      },
    };
    try {
      state.micStream = await navigator.mediaDevices.getUserMedia(want);
    } catch (e) {
      if (deviceId) {
        /* 그 마이크가 사라졌으면 아무 마이크나 */
        state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else { throw e; }
    }
    return state.micStream;
  }

  function stopMic() {
    if (state.micStream) {
      for (const t of state.micStream.getTracks()) { try { t.stop(); } catch (_) {} }
    }
    state.micStream = null;
  }

  function meterOf(ctx, node) {
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.5;
    node.connect(an);
    const buf = new Uint8Array(an.fftSize);
    return function level() {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
      return Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
    };
  }

  /**
   * 컴퓨터 소리와 마이크를 하나로 섞는다. 둘 다 없으면 null.
   * 여기서는 스피커로 내보내지 않는다 — 내보내면 그 소리가 다시 녹음돼 메아리가 진다.
   */
  function buildAudio(opts) {
    closeAudio();
    const o = opts || {};
    const sysTracks = (o.systemAudio && state.stream) ? state.stream.getAudioTracks() : [];
    const micTracks = (o.micOn && state.micStream) ? state.micStream.getAudioTracks() : [];
    if (!sysTracks.length && !micTracks.length) return null;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx({ sampleRate: 48000, latencyHint: 'playback' });
    const dest = ctx.createMediaStreamDestination();
    state.audioCtx = ctx;
    state.mixDest = dest;

    if (sysTracks.length) {
      const src = ctx.createMediaStreamSource(new MediaStream(sysTracks));
      const g = ctx.createGain();
      g.gain.value = o.sysGain === undefined ? 1 : o.sysGain;
      src.connect(g).connect(dest);
      state.sysGain = g;
      state.sysMeter = meterOf(ctx, g);
    }
    if (micTracks.length) {
      const src = ctx.createMediaStreamSource(new MediaStream(micTracks));
      const g = ctx.createGain();
      g.gain.value = o.micGain === undefined ? 1 : o.micGain;
      src.connect(g).connect(dest);
      state.micGain = g;
      state.micMeter = meterOf(ctx, g);
    }
    try { ctx.resume(); } catch (_) {}
    return dest.stream.getAudioTracks()[0] || null;
  }

  function setGain(which, v) {
    const g = which === 'mic' ? state.micGain : state.sysGain;
    if (g) { try { g.gain.value = Math.max(0, Math.min(3, v)); } catch (_) {} }
  }

  function levels() {
    return {
      sys: state.sysMeter ? state.sysMeter() : null,
      mic: state.micMeter ? state.micMeter() : null,
    };
  }

  function closeAudio() {
    state.sysGain = null;
    state.micGain = null;
    state.sysMeter = null;
    state.micMeter = null;
    state.mixDest = null;
    if (state.audioCtx) { try { state.audioCtx.close(); } catch (_) {} }
    state.audioCtx = null;
  }

  /* ── ④ 녹화 ────────────────────────────────────────────────────── */

  /** 서버로 조각을 차례차례 넘기는 일꾼 */
  function makeUploader(id, onStat) {
    const q = [];
    let busy = false;
    let bytes = 0;
    let failed = 0;
    let done = null;

    async function one(blob) {
      for (let t = 0; t < 3; t++) {
        try {
          const res = await fetch('/api/rec/chunk?id=' + encodeURIComponent(id), {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: blob,
          });
          const j = await res.json();
          if (j && j.ok) { bytes = j.bytes; return true; }
        } catch (_) { /* 아래에서 다시 */ }
        await sleep(150 * (t + 1));
      }
      return false;
    }

    async function pump() {
      if (busy) return;
      busy = true;
      while (q.length) {
        const blob = q.shift();
        const ok = await one(blob);
        if (!ok) failed++;
        /* 파일에 실제로 쌓인 만큼을 알려 준다 — 이래야 "지금 몇 MB" 가 살아 움직인다 */
        if (onStat) { try { onStat({ bytes: bytes, failed: failed, waiting: q.length }); } catch (_) {} }
      }
      busy = false;
      if (done) { const f = done; done = null; f(); }
    }

    return {
      push(blob) { if (blob && blob.size) { q.push(blob); pump(); } },
      async drain() {
        if (!q.length && !busy) return;
        await new Promise((resolve) => { done = resolve; pump(); });
      },
      stats() { return { bytes, failed, waiting: q.length }; },
    };
  }

  /**
   * 녹화 시작.
   *   opts: {rect, out, fps, quality, format, saveMode, systemAudio, micOn, sysGain, micGain}
   *   훅  : onChunk(stats) · onError(msg)
   * 돌려주는 값: {mime, ext, videoBps, audioBps, out, mode, id, name, file}
   */
  async function startRecording(opts, hooks) {
    const o = opts || {};
    const h = hooks || {};

    const audioTrack = buildAudio(o);
    const hasAudio = !!audioTrack;
    const mime = pickMime(o.format === 'webm' ? 'webm' : 'mp4', hasAudio);
    if (!mime) throw new Error('이 브라우저는 화면 녹화 형식을 하나도 지원하지 않습니다.');

    const crop = startCrop(o.rect, o.out, o.fps);
    const tracks = [crop.track];
    if (audioTrack) tracks.push(audioTrack);
    const mixed = new MediaStream(tracks);

    const videoBps = S.bitrateFor(o.out.w, o.out.h, o.fps, o.quality);
    const audioBps = S.audioBitrateFor(o.quality);

    /* 파일부터 열어 둔다 — 열지 못하면 녹화를 시작하지 않는다 */
    const ext = extOf(mime);
    const begun = await postJson('/api/rec/begin', { ext });
    if (!begun.ok) { stopCrop(); closeAudio(); throw new Error(begun.message || '저장할 파일을 열지 못했습니다.'); }

    const uploader = makeUploader(begun.id, (st) => {
      if (h.onChunk) { try { h.onChunk(st); } catch (_) {} }
    });
    state.upload = uploader;

    let rec;
    try {
      rec = new MediaRecorder(mixed, {
        mimeType: mime,
        videoBitsPerSecond: videoBps,
        ...(hasAudio ? { audioBitsPerSecond: audioBps } : {}),
      });
    } catch (e) {
      await postJson('/api/rec/drop', { id: begun.id, reason: e.message });
      stopCrop(); closeAudio();
      throw new Error('녹화기를 만들지 못했습니다: ' + e.message);
    }

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) {
        uploader.push(e.data);
        if (h.onChunk) { try { h.onChunk(uploader.stats()); } catch (_) {} }
      }
    };
    rec.onerror = (e) => {
      const msg = (e && e.error && e.error.message) || '녹화 중 문제가 생겼습니다';
      if (h.onError) { try { h.onError(msg); } catch (_) {} }
    };

    state.recorder = rec;
    const slice = o.saveMode === 'once' ? undefined : 2000;
    if (slice) rec.start(slice); else rec.start();

    return {
      id: begun.id,
      name: begun.name,
      file: begun.file,
      mime, ext,
      videoBps, audioBps,
      out: o.out,
      mode: crop.mode,
      hasAudio,
    };
  }

  function pause() {
    if (state.recorder && state.recorder.state === 'recording') { state.recorder.pause(); return true; }
    return false;
  }

  function resume() {
    if (state.recorder && state.recorder.state === 'paused') { state.recorder.resume(); return true; }
    return false;
  }

  function recorderState() { return state.recorder ? state.recorder.state : 'inactive'; }

  /** 녹화를 끝내고, 남은 조각까지 모두 서버에 넘긴 뒤 결과를 돌려준다 */
  async function stopRecording(id, ms, meta) {
    const rec = state.recorder;
    if (rec && rec.state !== 'inactive') {
      await new Promise((resolve) => {
        rec.onstop = resolve;
        try { rec.stop(); } catch (_) { resolve(); }
        setTimeout(resolve, 8000);            // 혹시 onstop 이 안 와도 넘어간다
      });
    }
    state.recorder = null;
    stopCrop();
    closeAudio();

    const up = state.upload;
    state.upload = null;
    if (up) await up.drain();
    const stats = up ? up.stats() : { bytes: 0, failed: 0 };

    const done = await postJson('/api/rec/finish', { id, ms, meta });
    return { ...done, uploadFailed: stats.failed };
  }

  /* ── 서버와 이야기 ─────────────────────────────────────────────── */

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return res.json();
  }

  return {
    support, pickMime, extOf,
    grab, release, onEnded, sourceInfo, videoTrack, previewStream,
    startCrop, stopCrop,
    listMics, startMic, stopMic, buildAudio, setGain, levels, closeAudio,
    startRecording, stopRecording, pause, resume, recorderState,
    postJson,
  };
}());
