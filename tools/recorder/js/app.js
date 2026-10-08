/* 화면 영역 녹화기 — 화면 쪽 살림꾼.
 *
 * 서버(파일·설정·곁다리 도우미)와 브라우저(화면 잡기·녹화)를 이어 준다.
 * 웹판에서는 그 "서버" 를 js/local-server.js 가 브라우저 안에서 대신한다.
 * 실제로 화면을 잡고 영상을 만드는 일은 js/capture.js,
 * 네모를 고르는 일은 js/region.js 가 한다. 여기서는 그 둘을 부리고 화면을 갱신한다.
 */
(function () {
  'use strict';

  const S = window.Shared;
  const C = window.Capture;
  const $ = (id) => document.getElementById(id);

  const el = {};
  [
    'stateBadge', 'helperBadge', 'themeBtn', 'quitBtn', 'browserWarn', 'browserWarnText',
    'grabBtn', 'regrabBtn', 'releaseBtn', 'srcInfo',
    'autoBtn', 'allBtn', 'clearRegionBtn', 'aspectSel',
    'stage', 'preview', 'overlay', 'magnifier', 'stageHint', 'autoBusy', 'autoPct',
    'countBig', 'countNum',
    'rx', 'ry', 'rw', 'rh', 'regionNote',
    'startBtn', 'pauseBtn', 'stopBtn', 'recTime', 'recSize', 'cropPreview', 'outInfo', 'recHint',
    'resultCard', 'resName', 'resMeta', 'resVideo', 'resCheck', 'revealBtn', 'openFileBtn', 'againBtn',
    'recentList', 'logList', 'openDirBtn2',
    'outDirText', 'pickDirBtn', 'openDirBtn', 'prefixInput', 'nameSample',
    'dirTypeRow', 'dirTypeInput', 'dirTypeBtn',
    'qualitySel', 'fpsSel', 'scaleSel', 'formatSel', 'saveModeSel', 'saveModeNote',
    'sysAudioChk', 'sysGainRange', 'sysMeter', 'sysAudioNote',
    'micChk', 'micSel', 'micGainRange', 'micMeter',
    'countdownSel', 'maxMinutesInput', 'openWhenDoneChk',
    'showBorderChk', 'showBarChk', 'hotkeysChk', 'minimizeChk', 'hotkeyNote',
  ].forEach((id) => { el[id] = $(id); });

  const app = {
    settings: null,
    outDir: '',
    nativeInfo: { available: false, hotkeys: [], monitors: [] },
    source: null,          // 잡은 화면 정보
    region: null,          // {x,y,w,h,sw,sh}
    phase: 'idle',         // idle · ready · counting · recording · paused · saving
    rec: null,             // 지금 녹화 정보
    startAt: 0,
    pausedMs: 0,
    pausedAt: 0,
    bytes: 0,
    failedChunks: 0,
    timer: null,
    meterTimer: null,
    countTimer: null,
    maxTimer: null,
    cropRaf: null,
    saveTimer: null,
    support: C.support(),
  };

  let picker = null;

  /* ── 잔심부름 ─────────────────────────────────────────────────── */

  async function post(url, body) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      return await res.json();
    } catch (e) {
      return { ok: false, message: (e && e.message) || '서버와 이야기할 수 없습니다' };
    }
  }

  async function getJson(url) {
    try { const r = await fetch(url); return await r.json(); }
    catch (_) { return null; }
  }

  /* 알림은 서버에 넘기고, 서버가 모두에게 되돌려 주는 것을 그린다.
   * (여기서 바로 그리면 되돌아온 것과 겹쳐 두 줄로 보인다) */
  function toast(level, text) {
    post('/api/log', { level, text });
  }

  function addLog(line) {
    const div = document.createElement('div');
    div.className = 'log-line ' + (line.level || 'info');
    const t = new Date(line.at || Date.now());
    div.innerHTML = '<span class="log-time">' + String(t.getHours()).padStart(2, '0') + ':'
      + String(t.getMinutes()).padStart(2, '0') + ':' + String(t.getSeconds()).padStart(2, '0')
      + '</span> ' + escapeHtml(line.text);
    el.logList.prepend(div);
    while (el.logList.children.length > 120) el.logList.lastChild.remove();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function badge(text, kind) {
    el.stateBadge.textContent = text;
    el.stateBadge.className = 'badge' + (kind ? ' ' + kind : '');
  }

  /* ── 설정 ─────────────────────────────────────────────────────── */

  let saveQueued = null;
  function saveSettings(patch) {
    app.settings = { ...app.settings, ...patch };
    saveQueued = { ...(saveQueued || {}), ...patch };
    clearTimeout(app.saveTimer);
    app.saveTimer = setTimeout(async () => {
      const p = saveQueued;
      saveQueued = null;
      const r = await post('/api/settings', { patch: p });
      if (r && r.ok) { app.settings = r.settings; app.outDir = r.outDir; paintSettings(); }
    }, 250);
    refreshEstimate();
  }

  function paintSettings() {
    const s = app.settings;
    if (!s) return;
    /* className 을 통째로 갈아 끼우면 녹화 중 표시(is-recording)가 날아간다 — 필요한 것만 켜고 끈다 */
    document.body.classList.toggle('dark', s.theme !== 'light');
    el.outDirText.textContent = app.outDir || '—';
    el.outDirText.title = app.outDir || '';
    if (document.activeElement !== el.prefixInput) el.prefixInput.value = s.prefix;
    el.qualitySel.value = s.quality;
    el.fpsSel.value = String(s.fps);
    el.scaleSel.value = s.scale;
    el.formatSel.value = s.format;
    el.saveModeSel.value = s.saveMode || 'stream';
    el.sysAudioChk.checked = s.systemAudio;
    el.sysGainRange.value = String(Math.round(s.sysGain * 100));
    el.micChk.checked = s.micOn;
    el.micGainRange.value = String(Math.round(s.micGain * 100));
    el.micSel.disabled = !s.micOn;
    el.micGainRange.disabled = !s.micOn;
    el.countdownSel.value = String(s.countdown);
    el.maxMinutesInput.value = s.maxMinutes ? String(s.maxMinutes) : '';
    el.openWhenDoneChk.checked = s.openFolderWhenDone;
    el.showBorderChk.checked = s.showBorder;
    el.showBarChk.checked = s.showBar;
    el.hotkeysChk.checked = s.hotkeys;
    el.minimizeChk.checked = s.minimizeWhileRecording;
    el.aspectSel.value = s.aspect;
    el.nameSample.textContent = '보기: ' + S.stampName(s.prefix, new Date(), preferredExt());
    el.saveModeNote.textContent = (s.saveMode === 'once')
      ? '끝날 때 통째로 저장합니다. 재생기 호환성이 가장 좋지만, 아주 긴 녹화에는 조각내기 쪽이 안전합니다.'
      : '1~2초마다 파일에 이어 붙입니다. 도중에 프로그램이 꺼져도 그때까지는 남습니다.';
    updateHelperUi();
  }

  function preferredExt() {
    const s = app.settings || {};
    const mime = C.pickMime(s.format === 'webm' ? 'webm' : 'mp4', true);
    return mime ? C.extOf(mime) : 'mp4';
  }

  function updateHelperUi() {
    const n = app.nativeInfo || {};
    if (n.available) {
      const keys = (n.hotkeys || []).length ? n.hotkeys.join(' · ') : '없음';
      el.helperBadge.textContent = '도우미 준비됨';
      el.helperBadge.className = 'badge ok';
      el.helperBadge.title = '모니터 ' + (n.monitors || []).length + '대 · 단축키 ' + keys;
      el.hotkeyNote.textContent = (n.hotkeys || []).length
        ? ('쓸 수 있는 단축키: ' + (n.hotkeys || []).join(' · ') + '  (F9·Ctrl+Alt+R = 시작/중지, F10·Ctrl+Alt+P = 잠깐 멈춤)')
        : '전역 단축키는 “전역 단축키 쓰기” 를 켜고 화면을 잡으면 등록됩니다.';
    } else {
      el.helperBadge.textContent = '도우미 없음';
      el.helperBadge.className = 'badge';
      el.helperBadge.title = n.lastError || '';
      el.hotkeyNote.textContent = '이 PC 에서는 곁다리 도우미를 쓸 수 없어 전역 단축키·빨간 테두리·조작 막대가 동작하지 않습니다. 녹화 자체는 됩니다.';
      el.minimizeChk.disabled = true;
    }
    const canMinimize = !!n.available && (app.settings ? (app.settings.showBar || app.settings.hotkeys) : true);
    el.minimizeChk.disabled = !canMinimize;
    if (!canMinimize && el.minimizeChk.checked) el.minimizeChk.checked = false;
  }

  /* ── 예상 용량 ────────────────────────────────────────────────── */

  function plannedOut() {
    const s = app.settings;
    if (!app.region || !s) return null;
    const out = S.outputSize(app.region.w, app.region.h, s.scale);
    /* 잡아 온 화면이 30장짜리면 60 을 골라 놨어도 30장밖에 안 나온다 — 실제 값으로 셈한다 */
    const srcFps = (app.source && app.source.fps) ? app.source.fps : s.fps;
    const fps = Math.max(1, Math.min(s.fps, srcFps));
    const videoBps = S.bitrateFor(out.w, out.h, fps, s.quality);
    const hasAudio = !!(s.systemAudio && app.source && app.source.hasAudio) || !!s.micOn;
    const audioBps = hasAudio ? S.audioBitrateFor(s.quality) : 0;
    return { out, fps, videoBps, audioBps, perMin: S.sizePerMinute(videoBps, audioBps), hasAudio };
  }

  function refreshEstimate() {
    const p = plannedOut();
    if (!p) { el.outInfo.textContent = ''; return; }
    const s = app.settings;
    const mime = C.pickMime(s.format === 'webm' ? 'webm' : 'mp4', p.hasAudio);
    const parts = [
      '저장 크기 ' + p.out.w + '×' + p.out.h,
      p.fps + 'fps',
      S.fmtBps(p.videoBps) + (p.audioBps ? ' + 소리 ' + S.fmtBps(p.audioBps) : ' · 소리 없음'),
      (mime ? C.extOf(mime) : '?') + ' 형식',
      '1분에 약 ' + S.fmtBytes(p.perMin),
    ];
    el.outInfo.textContent = parts.join('  ·  ');

    if (app.region && (app.region.w !== p.out.w || app.region.h !== p.out.h)) {
      el.regionNote.textContent = '→ ' + p.out.w + '×' + p.out.h + ' 로 줄여 저장합니다';
    } else {
      el.regionNote.textContent = app.region ? '원본 크기 그대로 저장합니다' : '';
    }
  }

  /* ── 화면 잡기 ────────────────────────────────────────────────── */

  async function grabScreen() {
    if (!app.support.display) {
      toast('err', '이 브라우저는 화면 잡기를 지원하지 않습니다.');
      return;
    }
    el.grabBtn.disabled = true;
    try {
      const info = await C.grab({
        fps: app.settings.fps,
        systemAudio: app.settings.systemAudio,
      });
      app.source = info;
      el.preview.srcObject = C.previewStream();
      el.preview.muted = true;
      await el.preview.play().catch(() => {});
      el.stageHint.classList.add('hidden');

      picker.setSource(info.w, info.h);
      picker.setAspect(app.settings.aspect);

      /* 지난번 영역이 같은 크기의 화면이면 그대로 되살린다 */
      const last = app.settings.lastRegion;
      if (last && last.sw === info.w && last.sh === info.h) picker.setRect(last);
      else picker.selectAll();

      C.onEnded(onShareEnded);
      setPhase('ready');
      startCropPreview();

      if (app.settings.micOn) await enableMic(true);
      buildMeters();
      if (app.settings.hotkeys) await post('/api/helper/hotkeys', { on: true });

      const bits = [
        info.surface === 'monitor' ? '화면 전체' : (info.surface === 'window' ? '창 하나' : '탭'),
        info.w + '×' + info.h,
        (info.fps || app.settings.fps) + 'fps',
        info.hasAudio ? '소리 있음' : '소리 없음',
      ];
      el.srcInfo.innerHTML = '<b>' + escapeHtml(bits.join(' · ')) + '</b>'
        + (info.label ? '<br><span class="muted-small">' + escapeHtml(info.label) + '</span>' : '');
      el.sysAudioNote.textContent = info.hasAudio
        ? '컴퓨터 소리가 들어오고 있습니다.'
        : '소리가 들어오지 않습니다 — 화면을 다시 잡고 “시스템 오디오도 공유” 를 켜 주세요.';
      el.sysAudioNote.className = info.hasAudio ? 'muted-small ok-text' : 'muted-small warn-text';

      if (!info.hasAudio && app.settings.systemAudio) {
        toast('warn', '화면은 잡았지만 컴퓨터 소리가 함께 오지 않았습니다. “시스템 오디오도 공유” 를 켜고 다시 잡아 주세요.');
      } else {
        toast('ok', '화면을 잡았습니다 — ' + bits.join(' · '));
      }
      if (info.surface !== 'monitor') {
        toast('warn', '창·탭을 고르면 빨간 테두리를 화면에 그릴 수 없습니다. [전체 화면] 을 고르는 쪽을 권합니다.');
      }
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) toast('info', '화면 잡기를 취소했습니다.');
      else toast('err', '화면을 잡지 못했습니다: ' + ((e && e.message) || e));
    } finally {
      el.grabBtn.disabled = false;
    }
  }

  function onShareEnded() {
    if (app.phase === 'recording' || app.phase === 'paused') {
      toast('warn', '화면 공유가 끊겨 녹화를 마칩니다.');
      stopRecording();
    } else {
      releaseScreen(true);
    }
  }

  function releaseScreen(quiet) {
    stopCropPreview();
    C.release();
    app.source = null;
    app.region = null;
    el.preview.srcObject = null;
    el.stageHint.classList.remove('hidden');
    picker.setSource(0, 0);
    el.srcInfo.textContent = '아직 잡은 화면이 없습니다.';
    post('/api/helper/overlay', { state: 'off' });
    post('/api/helper/hotkeys', { on: false });
    setPhase('idle');
    if (!quiet) toast('info', '화면을 놓아주었습니다.');
  }

  /* ── 잘라 낸 그림 미리 보기 ───────────────────────────────────── */

  function startCropPreview() {
    stopCropPreview();
    const cv = el.cropPreview;
    const ctx = cv.getContext('2d');
    const tick = () => {
      app.cropRaf = requestAnimationFrame(tick);
      const r = app.region;
      const v = el.preview;
      if (!r || !v.videoWidth) return;
      const W = 192;
      const H = Math.max(24, Math.round((W * r.h) / r.w));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      try { ctx.drawImage(v, r.x, r.y, r.w, r.h, 0, 0, W, H); } catch (_) {}
    };
    app.cropRaf = requestAnimationFrame(tick);
  }

  function stopCropPreview() {
    if (app.cropRaf) cancelAnimationFrame(app.cropRaf);
    app.cropRaf = null;
  }

  /* ── 영역 ─────────────────────────────────────────────────────── */

  function onRegion(r, dragging) {
    app.region = r;
    const on = !!r;
    el.rx.disabled = el.ry.disabled = el.rw.disabled = el.rh.disabled = !on;
    if (on && document.activeElement !== el.rx && document.activeElement !== el.ry
      && document.activeElement !== el.rw && document.activeElement !== el.rh) {
      el.rx.value = r.x; el.ry.value = r.y; el.rw.value = r.w; el.rh.value = r.h;
    }
    refreshEstimate();
    updateButtons();
    if (!dragging) {
      if (r) saveSettings({ lastRegion: r });
      syncOverlay();
    }
  }

  function readNumbers() {
    if (!app.source) return;
    const r = {
      x: Number(el.rx.value) || 0,
      y: Number(el.ry.value) || 0,
      w: Number(el.rw.value) || 0,
      h: Number(el.rh.value) || 0,
    };
    if (r.w < 16 || r.h < 16) return;
    picker.setRect(r);
  }

  async function autoFind() {
    if (!app.source) return;
    el.autoBusy.classList.remove('hidden');
    el.autoBtn.disabled = true;
    try {
      const found = await picker.autoFind((p) => { el.autoPct.textContent = ' ' + Math.round(p * 100) + '%'; });
      if (found) toast('ok', '움직이는 곳을 찾았습니다 — ' + found.w + '×' + found.h);
      else toast('warn', '움직이는 곳을 찾지 못했습니다. 영상을 재생한 상태로 다시 눌러 보세요.');
    } catch (e) {
      toast('err', '자동으로 찾다가 문제가 생겼습니다: ' + ((e && e.message) || e));
    } finally {
      el.autoBusy.classList.add('hidden');
      el.autoPct.textContent = '';
      el.autoBtn.disabled = false;
    }
  }

  /* ── 테두리·막대 맞추기 ───────────────────────────────────────── */

  function overlayState() {
    if (app.phase === 'recording') return 'rec';
    if (app.phase === 'paused') return 'pause';
    if (app.phase === 'counting') return 'count';
    if (app.phase === 'ready' && app.region) return 'aim';
    return 'off';
  }

  function syncOverlay(text) {
    const st = overlayState();
    if (st === 'off' || !app.region) { post('/api/helper/overlay', { state: 'off' }); return; }
    post('/api/helper/overlay', {
      state: st,
      rect: { x: app.region.x, y: app.region.y, w: app.region.w, h: app.region.h },
      stream: { w: app.region.sw, h: app.region.sh },
      monitorOnly: app.source ? app.source.surface === 'monitor' : true,
      text: text || el.recTime.textContent,
    });
  }

  /* ── 소리 ─────────────────────────────────────────────────────── */

  async function enableMic(on) {
    if (!on) { C.stopMic(); buildMeters(); return; }
    try {
      await C.startMic(app.settings.micDeviceId);
      const mics = await C.listMics();
      fillMicList(mics);
      buildMeters();
    } catch (e) {
      toast('err', '마이크를 쓸 수 없습니다: ' + ((e && e.message) || e));
      el.micChk.checked = false;
      saveSettings({ micOn: false });
    }
  }

  function fillMicList(mics) {
    const cur = app.settings.micDeviceId;
    el.micSel.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = '';
    auto.textContent = '기본 마이크';
    el.micSel.appendChild(auto);
    mics.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.label || ('마이크 ' + (i + 1));
      el.micSel.appendChild(o);
    });
    el.micSel.value = mics.some((m) => m.id === cur) ? cur : '';
  }

  /** 소리 크기 막대 그리기 — 녹화 중에는 진짜 녹음되는 소리를 그대로 보여 준다 */
  function startMeterLoop() {
    clearInterval(app.meterTimer);
    app.meterTimer = setInterval(() => {
      const lv = C.levels();
      paintMeter(el.sysMeter, lv.sys);
      paintMeter(el.micMeter, lv.mic);
    }, 90);
  }

  /**
   * 소리 막대는 녹화 중이 아닐 때도 보여 준다(마이크가 켜져 있는지 눈으로 확인).
   * 녹화 중이라면 이미 진짜 믹서가 돌고 있으므로 건드리지 않고 읽기만 한다.
   */
  function buildMeters() {
    if (app.phase === 'recording' || app.phase === 'paused') { startMeterLoop(); return; }
    const s = app.settings;
    const any = (s.systemAudio && app.source && app.source.hasAudio) || (s.micOn);
    if (!any) {
      clearInterval(app.meterTimer);
      C.closeAudio();
      paintMeter(el.sysMeter, 0);
      paintMeter(el.micMeter, 0);
      return;
    }
    C.buildAudio({ systemAudio: s.systemAudio, micOn: s.micOn, sysGain: s.sysGain, micGain: s.micGain });
    startMeterLoop();
  }

  function paintMeter(node, v) {
    if (!node) return;
    const pct = v == null ? 0 : Math.round(v * 100);
    node.style.width = pct + '%';
    node.className = pct > 92 ? 'hot' : '';
  }

  /* ── 녹화 ─────────────────────────────────────────────────────── */

  function setPhase(p) {
    app.phase = p;
    updateButtons();
    const map = {
      idle: ['화면을 잡아 주세요', ''],
      ready: ['녹화 준비됨', 'ok'],
      counting: ['곧 시작합니다', 'warn'],
      recording: ['● 녹화 중', 'bad'],
      paused: ['잠깐 멈춤', 'warn'],
      saving: ['저장하는 중…', 'warn'],
    };
    const m = map[p] || map.idle;
    badge(m[0], m[1]);
    document.body.classList.toggle('is-recording', p === 'recording' || p === 'paused' || p === 'counting');
  }

  function updateButtons() {
    const has = !!app.source;
    const hasRegion = !!app.region;
    const rec = app.phase === 'recording' || app.phase === 'paused';
    el.grabBtn.classList.toggle('hidden', has);
    el.regrabBtn.classList.toggle('hidden', !has || rec);
    el.releaseBtn.classList.toggle('hidden', !has || rec);
    el.autoBtn.disabled = !has || rec;
    el.allBtn.disabled = !has || rec;
    el.clearRegionBtn.disabled = !has || rec;
    el.aspectSel.disabled = !has || rec;
    el.startBtn.disabled = !(has && hasRegion) || rec || app.phase === 'counting' || app.phase === 'saving';
    el.startBtn.classList.toggle('hidden', rec || app.phase === 'counting');
    el.pauseBtn.classList.toggle('hidden', !rec);
    el.stopBtn.classList.toggle('hidden', !rec && app.phase !== 'counting');
    el.pauseBtn.textContent = app.phase === 'paused' ? '▶ 계속하기' : '⏸ 잠깐 멈춤';
  }

  async function beginCountdown() {
    if (!app.region || !app.source) return;
    const n = app.settings.countdown | 0;
    if (n <= 0) { await startRecording(); return; }
    setPhase('counting');
    syncOverlay();
    el.countBig.classList.remove('hidden');
    let left = n;
    el.countNum.textContent = String(left);
    await new Promise((resolve) => {
      app.countTimer = setInterval(() => {
        left -= 1;
        if (app.phase !== 'counting') { clearInterval(app.countTimer); resolve(); return; }
        if (left <= 0) { clearInterval(app.countTimer); resolve(); return; }
        el.countNum.textContent = String(left);
        syncOverlay(String(left));
      }, 1000);
    });
    el.countBig.classList.add('hidden');
    if (app.phase !== 'counting') return;      // 도중에 취소됨
    await startRecording();
  }

  async function startRecording() {
    const p = plannedOut();
    if (!p) return;
    const s = app.settings;
    setPhase('saving');
    let info;
    try {
      info = await C.startRecording({
        rect: { x: app.region.x, y: app.region.y, w: app.region.w, h: app.region.h },
        out: p.out,
        fps: p.fps,
        quality: s.quality,
        format: s.format,
        saveMode: s.saveMode || 'stream',
        systemAudio: s.systemAudio,
        micOn: s.micOn,
        sysGain: s.sysGain,
        micGain: s.micGain,
      }, {
        onChunk: (st) => {
          app.bytes = st.bytes;
          app.failedChunks = st.failed;
          el.recSize.textContent = S.fmtBytes(st.bytes) + (st.failed ? ('  · 못 쓴 조각 ' + st.failed + '개') : '');
        },
        onError: (msg) => toast('err', '녹화 중 문제: ' + msg),
      });
    } catch (e) {
      setPhase('ready');
      toast('err', '녹화를 시작하지 못했습니다: ' + ((e && e.message) || e));
      return;
    }

    app.rec = info;
    app.startAt = Date.now();
    app.pausedMs = 0;
    app.pausedAt = 0;
    app.bytes = 0;
    app.failedChunks = 0;
    el.resultCard.classList.add('hidden');
    setPhase('recording');
    startMeterLoop();              // 이제부터는 진짜 녹음되는 소리를 그대로 보여 준다
    syncOverlay('00:00');

    el.recHint.textContent = info.mode === 'canvas'
      ? '이 브라우저에서는 창을 내려놓으면 녹화가 느려질 수 있습니다. 창을 열어 둔 채로 두세요.'
      : '녹화 중에는 다른 프로그램을 마음껏 써도 됩니다. 이 창을 내려놓아도 계속 찍힙니다.';

    toast('ok', '녹화 시작 — ' + info.name + ' (' + info.out.w + '×' + info.out.h + ', ' + S.fmtBps(info.videoBps)
      + (info.hasAudio ? ', 소리 있음' : ', 소리 없음') + ')');

    if (s.minimizeWhileRecording && app.nativeInfo.available && info.mode !== 'canvas') {
      setTimeout(() => post('/api/helper/window', { action: 'minimize' }), 400);
    }

    clearInterval(app.timer);
    app.timer = setInterval(tick, 250);

    clearTimeout(app.maxTimer);
    if (s.maxMinutes > 0) {
      app.maxTimer = setTimeout(() => {
        toast('warn', '정해 둔 최대 길이(' + s.maxMinutes + '분)에 닿아 스스로 멈춥니다.');
        stopRecording();
      }, s.maxMinutes * 60000);
    }
  }

  let lastBarText = '';
  function tick() {
    if (app.phase !== 'recording' && app.phase !== 'paused') return;
    const now = Date.now();
    const paused = app.pausedMs + (app.pausedAt ? now - app.pausedAt : 0);
    const ms = now - app.startAt - paused;
    const text = S.fmtDuration(ms);
    el.recTime.textContent = text;
    if (text !== lastBarText) { lastBarText = text; syncOverlay(text); }
  }

  function togglePause() {
    if (app.phase === 'recording') {
      if (C.pause()) {
        app.pausedAt = Date.now();
        setPhase('paused');
        syncOverlay();
        toast('info', '잠깐 멈췄습니다.');
      }
    } else if (app.phase === 'paused') {
      if (C.resume()) {
        app.pausedMs += Date.now() - app.pausedAt;
        app.pausedAt = 0;
        setPhase('recording');
        syncOverlay();
        toast('info', '다시 찍습니다.');
      }
    }
  }

  async function stopRecording() {
    if (app.phase === 'counting') {
      clearInterval(app.countTimer);
      el.countBig.classList.add('hidden');
      setPhase('ready');
      syncOverlay();
      return;
    }
    if (app.phase !== 'recording' && app.phase !== 'paused') return;

    const now = Date.now();
    const paused = app.pausedMs + (app.pausedAt ? now - app.pausedAt : 0);
    const ms = now - app.startAt - paused;

    clearInterval(app.timer);
    clearTimeout(app.maxTimer);
    setPhase('saving');
    post('/api/helper/overlay', { state: 'off' });
    if (app.settings.minimizeWhileRecording) post('/api/helper/window', { action: 'restore' });

    const info = app.rec;
    app.rec = null;
    let done;
    try {
      done = await C.stopRecording(info.id, ms, {
        out: info.out, mime: info.mime, videoBps: info.videoBps, audioBps: info.audioBps,
        region: app.region, mode: info.mode,
      });
    } catch (e) {
      toast('err', '저장을 마무리하지 못했습니다: ' + ((e && e.message) || e));
      setPhase(app.source ? 'ready' : 'idle');
      return;
    }

    if (done && done.uploadFailed) {
      toast('err', done.uploadFailed + '개의 영상 조각을 파일에 쓰지 못했습니다. 디스크 여유 공간을 확인해 주세요.');
    }
    if (done && done.ok) showResult(done.result);
    else toast('err', (done && done.message) || '저장하지 못했습니다.');

    el.recTime.textContent = '00:00';
    el.recSize.textContent = '—';
    setPhase(app.source ? 'ready' : 'idle');
    buildMeters();
    if (app.source) syncOverlay();
    loadRecent();
  }

  function showResult(r) {
    if (!r) return;
    el.resultCard.classList.remove('hidden');
    el.resName.textContent = r.name;
    el.resMeta.textContent = [r.durationText, r.sizeText, r.dir].join('  ·  ');
    el.resCheck.textContent = '재생기를 여는 중…';
    el.resVideo.src = window.LocalServer.urlFor(r.file);   // 웹판: 브라우저 안의 영상 주소
    el.resVideo.onloadedmetadata = () => {
      const d = el.resVideo.duration;
      const ok = isFinite(d) && d > 0;
      el.resCheck.textContent = ok
        ? ('확인: ' + S.fmtDuration(d * 1000) + ' · ' + el.resVideo.videoWidth + '×' + el.resVideo.videoHeight + ' — 정상적으로 열립니다.')
        : '확인: 길이를 읽지 못했습니다. 재생은 되지만 일부 재생기에서 시간이 안 보일 수 있습니다.';
      el.resCheck.className = ok ? 'muted-small ok-text' : 'muted-small warn-text';
    };
    el.resVideo.onerror = () => {
      el.resCheck.textContent = '확인: 이 창에서는 열지 못했습니다. 파일은 저장되어 있으니 재생기로 열어 보세요.';
      el.resCheck.className = 'muted-small warn-text';
    };
    el.revealBtn.onclick = () => post('/api/reveal', { file: r.file });
    el.openFileBtn.onclick = () => post('/api/open-file', { file: r.file });
  }

  /* ── 지난 녹화 ────────────────────────────────────────────────── */

  async function loadRecent() {
    const r = await getJson('/api/recent');
    paintRecent(r && r.items ? r.items : []);
  }

  function paintRecent(items) {
    el.recentList.innerHTML = '';
    if (!items.length) {
      el.recentList.innerHTML = '<div class="muted-small">아직 녹화한 영상이 없습니다.</div>';
      return;
    }
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'recent-row';
      const when = new Date(it.at);
      row.innerHTML = '<span class="recent-name" title="' + escapeHtml(it.file) + '">' + escapeHtml(it.name) + '</span>'
        + '<span class="muted-small">' + S.fmtBytes(it.bytes) + '</span>'
        + '<span class="muted-small">' + when.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</span>';
      const b1 = document.createElement('button');
      b1.className = 'btn tiny';
      b1.textContent = '받기';   // 웹판: 다시 내려받기
      b1.onclick = () => post('/api/open-file', { file: it.file });
      const b2 = document.createElement('button');
      b2.className = 'btn tiny';
      b2.textContent = '폴더';
      b2.onclick = () => post('/api/reveal', { file: it.file });
      row.appendChild(b1);
      el.recentList.appendChild(row);
    }
  }

  /* ── 서버가 보내오는 소식 ─────────────────────────────────────── */

  function listen() {
    const es = new EventSource('/api/events');
    es.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch (_) { return; }
      if (m.type === 'hello') {
        app.settings = m.settings;
        app.outDir = m.outDir;
        app.nativeInfo = m.native || app.nativeInfo;
        paintSettings();
        paintRecent(m.recent || []);
        refreshEstimate();
      } else if (m.type === 'settings') {
        app.settings = m.settings;
        app.outDir = m.outDir;
        paintSettings();
      } else if (m.type === 'native') {
        app.nativeInfo = m.native;
        updateHelperUi();
      } else if (m.type === 'log') {
        addLog(m.line);
      } else if (m.type === 'recent') {
        paintRecent(m.items || []);
      } else if (m.type === 'hotkey') {
        onHotkey(m.key);
      } else if (m.type === 'barAction') {
        if (m.action === 'stop') stopRecording();
        else if (m.action === 'pause') togglePause();
      }
    };
    es.onerror = () => { /* 서버가 꺼지면 브라우저가 알아서 다시 붙는다 */ };
  }

  function onHotkey(key) {
    if (key === 'F9' || key === 'Ctrl+Alt+R') {
      if (app.phase === 'recording' || app.phase === 'paused' || app.phase === 'counting') stopRecording();
      else if (app.phase === 'ready') beginCountdown();
    } else if (key === 'F10' || key === 'Ctrl+Alt+P') {
      togglePause();
    }
  }

  /* ── 이어 붙이기 ──────────────────────────────────────────────── */

  function bind() {
    el.grabBtn.onclick = grabScreen;
    el.regrabBtn.onclick = grabScreen;
    el.releaseBtn.onclick = () => releaseScreen(false);

    el.autoBtn.onclick = autoFind;
    el.allBtn.onclick = () => picker.selectAll();
    el.clearRegionBtn.onclick = () => picker.clear();
    el.aspectSel.onchange = () => { picker.setAspect(el.aspectSel.value); saveSettings({ aspect: el.aspectSel.value }); };
    [el.rx, el.ry, el.rw, el.rh].forEach((n) => {
      n.addEventListener('change', readNumbers);
      n.addEventListener('keydown', (e) => { if (e.key === 'Enter') readNumbers(); });
    });

    el.startBtn.onclick = beginCountdown;
    el.pauseBtn.onclick = togglePause;
    el.stopBtn.onclick = stopRecording;
    el.againBtn.onclick = () => { el.resultCard.classList.add('hidden'); if (app.phase === 'ready') beginCountdown(); };

    el.pickDirBtn.onclick = async () => {
      const r = await post('/api/pick-folder');
      if (r && r.ok) {
        toast('ok', '저장 폴더를 바꿨습니다: ' + r.outDir);
        el.dirTypeRow.classList.add('hidden');
        loadRecent();
        return;
      }
      if (r && r.cancelled) return;               // 정말 사용자가 닫은 것
      if (r && r.message) toast('err', r.message);
      /* 창을 못 띄웠다면(정책으로 막힌 PC 등) 경로를 직접 적을 수 있게 열어 준다 */
      if (r && r.blocked) {
        el.dirTypeRow.classList.remove('hidden');
        el.dirTypeInput.value = app.outDir || '';
        el.dirTypeInput.focus();
        el.dirTypeInput.select();
      }
    };

    el.dirTypeBtn.onclick = async () => {
      const dir = el.dirTypeInput.value.trim();
      if (!dir) return;
      const r = await post('/api/set-folder', { dir });
      if (r && r.ok) {
        toast('ok', '저장 폴더를 바꿨습니다: ' + r.outDir);
        el.dirTypeRow.classList.add('hidden');
        loadRecent();
      } else toast('err', (r && r.message) || '그 폴더는 쓸 수 없습니다.');
    };
    el.dirTypeInput.onkeydown = (e) => { if (e.key === 'Enter') el.dirTypeBtn.click(); };
    el.openDirBtn.onclick = () => post('/api/open-folder', {});
    el.openDirBtn2.onclick = () => post('/api/open-folder', {});

    el.prefixInput.oninput = () => saveSettings({ prefix: el.prefixInput.value });
    el.qualitySel.onchange = () => saveSettings({ quality: el.qualitySel.value });
    el.fpsSel.onchange = () => saveSettings({ fps: Number(el.fpsSel.value) });
    el.scaleSel.onchange = () => saveSettings({ scale: el.scaleSel.value });
    el.formatSel.onchange = () => saveSettings({ format: el.formatSel.value });
    el.saveModeSel.onchange = () => saveSettings({ saveMode: el.saveModeSel.value });

    el.sysAudioChk.onchange = () => { saveSettings({ systemAudio: el.sysAudioChk.checked }); buildMeters(); };
    el.sysGainRange.oninput = () => {
      const v = Number(el.sysGainRange.value) / 100;
      C.setGain('sys', v);
      saveSettings({ sysGain: v });
    };
    el.micChk.onchange = async () => {
      const on = el.micChk.checked;
      saveSettings({ micOn: on });
      el.micSel.disabled = !on;
      el.micGainRange.disabled = !on;
      await enableMic(on);
    };
    el.micSel.onchange = async () => {
      saveSettings({ micDeviceId: el.micSel.value });
      if (el.micChk.checked) await enableMic(true);
    };
    el.micGainRange.oninput = () => {
      const v = Number(el.micGainRange.value) / 100;
      C.setGain('mic', v);
      saveSettings({ micGain: v });
    };

    el.countdownSel.onchange = () => saveSettings({ countdown: Number(el.countdownSel.value) });
    el.maxMinutesInput.onchange = () => saveSettings({ maxMinutes: Number(el.maxMinutesInput.value) || 0 });
    el.openWhenDoneChk.onchange = () => saveSettings({ openFolderWhenDone: el.openWhenDoneChk.checked });

    el.showBorderChk.onchange = () => { saveSettings({ showBorder: el.showBorderChk.checked }); syncOverlay(); };
    el.showBarChk.onchange = () => { saveSettings({ showBar: el.showBarChk.checked }); updateHelperUi(); syncOverlay(); };
    el.hotkeysChk.onchange = async () => {
      saveSettings({ hotkeys: el.hotkeysChk.checked });
      updateHelperUi();
      await post('/api/helper/hotkeys', { on: el.hotkeysChk.checked && !!app.source });
    };
    el.minimizeChk.onchange = () => saveSettings({ minimizeWhileRecording: el.minimizeChk.checked });

    el.themeBtn.onclick = () => saveSettings({ theme: (app.settings.theme === 'dark' ? 'light' : 'dark') });
    el.quitBtn.onclick = async () => {
      if (app.phase === 'recording' || app.phase === 'paused') {
        if (!confirm('녹화 중입니다. 지금 끝내고 저장한 뒤 종료할까요?')) return;
        await stopRecording();
      }
      await post('/api/quit');
      setTimeout(() => window.close(), 300);
    };

    /* 창 안에서 누르는 단축키 (전역 단축키가 없을 때를 위해) */
    document.addEventListener('keydown', (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'F9') { e.preventDefault(); onHotkey('F9'); }
      else if (e.key === 'F10') { e.preventDefault(); onHotkey('F10'); }
      else if (e.key === 'Escape' && app.phase === 'counting') stopRecording();
    });

    window.addEventListener('beforeunload', (e) => {
      if (app.phase === 'recording' || app.phase === 'paused') {
        e.preventDefault();
        e.returnValue = '녹화 중입니다. 정말 나가시겠습니까?';
      }
    });
  }

  /* ── 시작 ─────────────────────────────────────────────────────── */

  function checkBrowser() {
    const s = app.support;
    const bad = [];
    if (!s.display) bad.push('이 브라우저는 화면 잡기(getDisplayMedia)를 지원하지 않습니다.');
    if (!s.recorder) bad.push('이 브라우저는 녹화(MediaRecorder)를 지원하지 않습니다.');
    if (!s.chromium) bad.push('Microsoft Edge 나 Chrome 에서 열어야 컴퓨터에서 나는 소리까지 녹음할 수 있습니다.');
    if (s.display && s.recorder && !s.insertable) {
      bad.push('이 브라우저에서는 창을 내려놓으면 녹화가 느려질 수 있습니다(캔버스 방식으로 돕니다).');
    }
    if (!bad.length) { el.browserWarn.classList.add('hidden'); return; }
    el.browserWarnText.textContent = bad.join(' ');
    el.browserWarn.classList.remove('hidden');
  }

  async function boot() {
    picker = window.RegionPicker.create({
      stage: el.stage,
      video: el.preview,
      canvas: el.overlay,
      magnifier: el.magnifier,
      onChange: onRegion,
    });

    const st = await getJson('/api/state');
    if (st) {
      app.settings = st.settings;
      app.outDir = st.outDir;
      app.nativeInfo = st.native || app.nativeInfo;
      paintSettings();
    }
    bind();
    listen();
    checkBrowser();
    loadRecent();
    setPhase('idle');

    /* 곁다리 도우미는 조용히 준비해 둔다(없어도 그만) */
    const h = await post('/api/helper/ensure');
    if (h) { app.nativeInfo = h.native || app.nativeInfo; updateHelperUi(); }

    try { fillMicList(await C.listMics()); } catch (_) {}
  }

  boot();
}());
