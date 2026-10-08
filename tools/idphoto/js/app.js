/* 증명사진 만들기 — 화면 (웹판)
 *
 * 무거운 일은 전부 여기서 한다: 사진 열기 · 얼굴 찾기 · 자르기 · 굽기.
 * 설치판에서 서버가 하던 일(목록·명단·짝짓기)은 js/local-api.js 가 브라우저 안에서 대신하고,
 * 저장은 ZIP 으로 받거나 고른 폴더에 바로 쓴다.
 * 그래서 사진이 이 컴퓨터 밖으로 나가지 않는다 (얼굴 모델도 이 사이트 안에 있다).
 *
 * 자르는 자리 계산은 /js/crop.js 에 있다 — 자체 점검이 그 파일을 그대로 불러
 * 확인하므로, 화면이 쓰는 계산과 점검하는 계산이 절대 어긋나지 않는다.
 */
'use strict';

const $ = (id) => document.getElementById(id);
const api = (p, body) => LocalApi.call(p, body);

let snap = null;
let shots = [];          // 만들어 둔 결과 {index, ok, canvas, blob, face, why, nudgeY, zoom}
let filter = 'all';
let modelReady = false;
let busy = false;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 4200);
  setTimeout(() => el.remove(), 4600);
}

const guard = (fn) => async (...a) => {
  try { await fn(...a); } catch (e) { toast((e && e.message) || '실패했습니다', 'err'); }
};

function kbText(n) {
  if (n == null) return '';
  return n < 1024 ? n + 'B' : (n / 1024).toFixed(0) + 'KB';
}

const sleep = (m) => new Promise((r) => setTimeout(r, m));

/* ── 얼굴 찾기 준비 ───────────────────────────────────── */

async function ensureModel() {
  if (modelReady) return true;
  if (typeof faceapi === 'undefined') throw new Error('얼굴 찾기 꾸러미를 못 읽었습니다');
  progress('얼굴 찾기 모델을 읽는 중…', 0, 1);
  await faceapi.nets.tinyFaceDetector.loadFromUri(new URL('models', document.baseURI).href);
  modelReady = true;
  return true;
}

/* ── 사진 한 장 만들기 ────────────────────────────────── */

/** EXIF 방향까지 반영해 사진을 연다. 못 열면 왜 못 여는지 남긴다. */
async function loadImage(url, file) {
  let blob;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('읽지 못했습니다');
    blob = await res.blob();
  } catch (e) { throw new Error('파일을 읽지 못했습니다'); }

  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch (_) {
    if (file && file.maybe) {
      throw new Error('이 브라우저가 못 여는 형식입니다 (윈도우에 HEIF 확장이 없습니다)');
    }
    // 방향 옵션을 못 받는 브라우저면 그냥 열어 본다
    try { return await createImageBitmap(blob); }
    catch (_) { throw new Error('사진을 열지 못했습니다 (파일이 깨졌을 수 있습니다)'); }
  }
}

/* 얼굴을 찾을 때 쓰는 사본의 긴 변. 원본 그대로 넣으면 느리기만 하고 더 잘 찾지도 않는다. */
const DETECT_LONG = 640;

/**
 * 얼굴 찾기.
 *
 * face-api 는 ImageBitmap 을 못 받는다 (HTMLImageElement · Canvas · Tensor 만 받는다).
 * 그래서 캔버스에 옮겨 그린 뒤 넘긴다. 이왕 옮기는 김에 작게 줄여서 넘기고,
 * 찾은 자리는 원본 좌표로 되돌린다 — 4000px 사진을 그대로 넣으면 몇 초씩 걸린다.
 */
async function detectFace(bmp) {
  const long = Math.max(bmp.width, bmp.height);
  const k = long > DETECT_LONG ? DETECT_LONG / long : 1;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0, c.width, c.height);

  const det = await faceapi.detectAllFaces(c,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.35 }));
  if (!det.length) return null;

  const boxes = det.map((d) => ({
    x: d.box.x / k, y: d.box.y / k, width: d.box.width / k, height: d.box.height / k, score: d.score,
  }));
  const best = CropMath.biggest(boxes);
  best.count = boxes.length;
  return best;
}

function specOut(spec, cropW, cropH) {
  if (spec.kind === 'fit') {
    const f = CropMath.fitInside({ width: cropW, height: cropH }, spec.long);
    return { w: f.width, h: f.height };
  }
  const w = Math.round(spec.width);
  const h = Math.round(w * spec.ratioH / spec.ratioW);
  return { w, h };
}

function drawCrop(bmp, crop, outW, outH) {
  const c = document.createElement('canvas');
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(bmp, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH);
  return c;
}

function toBlob(canvas, q) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', q));
}

/**
 * 목표 용량 아래로 굽는다.
 * 화질을 이분 탐색으로 낮춰 보고, 그래도 크면 크기를 줄인다.
 */
async function encodeToTarget(canvas, targetBytes) {
  if (!targetBytes) {
    const b = await toBlob(canvas, 0.92);
    return { blob: b, canvas, shrunk: false };
  }

  let work = canvas;
  for (let round = 0; round < 4; round++) {
    let s = { lo: 0.30, hi: 0.95, q: 0.85, best: null, tries: 0 };
    let bestBlob = null;
    for (;;) {
      const blob = await toBlob(work, s.q);
      if (blob.size <= targetBytes && (!bestBlob || blob.size > bestBlob.size)) bestBlob = blob;
      s = CropMath.nextQuality(s, blob.size, targetBytes);
      if (s.done) break;
    }
    if (bestBlob) return { blob: bestBlob, canvas: work, shrunk: round > 0 };

    // 화질을 최저로 해도 크다 — 크기를 줄여 다시 해 본다
    const c2 = document.createElement('canvas');
    c2.width = Math.max(40, Math.round(work.width * 0.8));
    c2.height = Math.max(40, Math.round(work.height * 0.8));
    const ctx = c2.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(work, 0, 0, c2.width, c2.height);
    work = c2;
  }
  const last = await toBlob(work, 0.30);
  return { blob: last, canvas: work, shrunk: true, over: true };
}

/** 사진 하나를 처음부터 끝까지 (얼굴 찾기 포함) */
async function buildShot(i, reuseFace) {
  const file = snap.files[i];
  const spec = snap.spec;
  const st = shots[i] || { index: i, nudgeY: 0, zoom: 1 };
  st.index = i;
  st.name = file.name;

  let bmp;
  try { bmp = await loadImage(file.url, file); }
  catch (e) { return { ...st, ok: false, why: e.message, blob: null, canvas: null }; }

  const img = { width: bmp.width, height: bmp.height };
  let face = reuseFace ? st.face : null;

  if (!face && spec.kind === 'id' && snap.settings.autoFace) {
    try {
      await ensureModel();
      face = await detectFace(bmp);
      st.faceCount = face ? face.count : 0;
    } catch (e) {
      face = null;
      st.detectError = (e && e.message) || '';
    }
  }
  st.face = face;

  const opt = {
    headRatio: snap.settings.headRatio,
    eyeLine: snap.settings.eyeLine,
    ratioW: spec.ratioW, ratioH: spec.ratioH,
    nudgeY: st.nudgeY, zoom: st.zoom,
  };

  let crop;
  let why = '';
  if (spec.kind === 'fit') {
    crop = { x: 0, y: 0, width: img.width, height: img.height, fitted: true, why: '' };
  } else if (face) {
    crop = CropMath.fromFace(face, img, opt);
    why = crop.why;
    if (st.faceCount > 1) why = (why ? why + ' · ' : '') + `얼굴이 ${st.faceCount}개 보여 가장 큰 것을 골랐습니다`;
  } else {
    crop = CropMath.centered(img, opt);
    why = snap.settings.autoFace ? crop.why : '';
  }

  const out = specOut(spec, crop.width, crop.height);
  const canvas = drawCrop(bmp, crop, out.w, out.h);
  const enc = await encodeToTarget(canvas, (spec.targetKB || 0) * 1024);
  if (enc.over) why = (why ? why + ' · ' : '') + '목표 용량까지 못 줄였습니다';
  else if (enc.shrunk) why = (why ? why + ' · ' : '') + '용량을 맞추려고 크기를 줄였습니다';

  if (bmp.close) bmp.close();

  return {
    ...st,
    ok: true,
    noFace: spec.kind === 'id' && !face && snap.settings.autoFace,
    why,
    blob: enc.blob,
    canvas: enc.canvas,
    outW: enc.canvas.width,
    outH: enc.canvas.height,
  };
}

/* ── 만들기 · 저장 ────────────────────────────────────── */

function progress(text, done, total) {
  $('workBar').hidden = false;
  $('workBarIn').style.width = total ? Math.round((done / total) * 100) + '%' : '0%';
  $('workNote').textContent = text;
}

function progressDone() {
  $('workBar').hidden = true;
  $('workNote').textContent = '';
}

const makeAll = guard(async (reuseFace) => {
  if (busy) return;
  if (!snap.files.length) { toast('사진을 먼저 넣으세요', 'warn'); return; }
  busy = true;
  render();
  const total = snap.files.length;
  const next = [];
  try {
    for (let i = 0; i < total; i++) {
      progress(`${i + 1} / ${total} — ${snap.files[i].name}`, i, total);
      // eslint-disable-next-line no-await-in-loop
      next[i] = await buildShot(i, reuseFace);
      if (i % 3 === 2) await sleep(0);      // 화면이 멈추지 않게
    }
  } finally {
    shots = next;
    busy = false;
    progressDone();
    render();
  }
  const bad = shots.filter((s) => !s.ok).length;
  const noFace = shots.filter((s) => s.ok && s.noFace).length;
  toast(`${shots.filter((s) => s.ok).length}장을 만들었습니다`
    + (noFace ? ` · 얼굴 못 찾음 ${noFace}장` : '')
    + (bad ? ` · 못 연 것 ${bad}장` : ''), bad ? 'warn' : 'ok');
});

/** 저장할 사진 목록 — 이름이 겹치면 _2, _3 을 붙인다 (설치판 서버와 같은 규칙) */
function savePlan() {
  const ready = shots.filter((s) => s && s.ok && s.blob);
  const used = new Set();
  return ready.map((s) => {
    const base = LocalApi.safeName(snap.files[s.index].out, '사진');
    let name = base + '.jpg';
    for (let n = 2; used.has(name.toLowerCase()); n++) name = base + '_' + n + '.jpg';
    used.add(name.toLowerCase());
    return { name, blob: s.blob };
  });
}

const saveAll = guard(async () => {
  if (busy) return;
  const list = savePlan();
  if (!list.length) { toast('저장할 것이 없습니다', 'warn'); return; }
  const folder = LocalApi.safeName(snap.settings.outDirName, '증명사진');
  busy = true;
  render();
  try {
    const z = Zip();
    for (let n = 0; n < list.length; n++) {
      progress(`ZIP 에 담는 중 ${n + 1} / ${list.length}`, n, list.length);
      // eslint-disable-next-line no-await-in-loop
      await z.add(folder + '/' + list[n].name, list[n].blob);
    }
    Zip.download(z.finish(), folder + '.zip');
    $('saveInfo').textContent = `${list.length}장을 ${folder}.zip 으로 받았습니다`;
    toast(`${list.length}장을 ZIP 으로 받았습니다`, 'ok');
  } finally {
    busy = false;
    progressDone();
    render();
  }
});

/** 크롬·엣지: 고른 폴더 아래 결과 폴더를 만들어 바로 쓴다 (있는 파일은 덮지 않는다) */
const saveToFolder = guard(async () => {
  if (busy) return;
  const list = savePlan();
  if (!list.length) { toast('저장할 것이 없습니다', 'warn'); return; }
  let root;
  try { root = await window.showDirectoryPicker({ id: 'idphoto', mode: 'readwrite' }); }
  catch (e) { if (e && e.name === 'AbortError') return; throw e; }
  const folder = LocalApi.safeName(snap.settings.outDirName, '증명사진');
  busy = true;
  render();
  let ok = 0;
  const failed = [];
  const exists = (dir, name) => dir.getFileHandle(name).then(() => true, () => false);
  try {
    const dir = await root.getDirectoryHandle(folder, { create: true });
    for (let n = 0; n < list.length; n++) {
      progress(`저장 중 ${n + 1} / ${list.length}`, n, list.length);
      const base = list[n].name.replace(/\.jpg$/, '');
      let name = list[n].name;
      // eslint-disable-next-line no-await-in-loop
      for (let k = 2; k < 500 && await exists(dir, name); k++) name = base + '_' + k + '.jpg';
      try {
        // eslint-disable-next-line no-await-in-loop
        const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
        // eslint-disable-next-line no-await-in-loop
        await w.write(list[n].blob);
        // eslint-disable-next-line no-await-in-loop
        await w.close();
        ok += 1;
      } catch (_) { failed.push(name); }
    }
  } finally {
    busy = false;
    progressDone();
    render();
  }
  $('saveInfo').textContent = `${ok}장을 ${root.name}/${folder} 에 저장했습니다`
    + (failed.length ? ` (${failed.length}장 실패)` : '');
  toast(`${ok}장을 저장했습니다` + (failed.length ? ` (${failed.length}장 실패)` : ''), failed.length ? 'warn' : 'ok');
});

/* ── 그리기 ───────────────────────────────────────────── */

function render() {
  if (!snap) return;

  $('inDir').value = snap.dir || '';
  $('dirBadge').textContent = snap.dir || '사진을 넣으세요';
  $('dirBadge').className = 'badge ' + (snap.dir ? 'ok' : 'mute');
  $('outNameEcho').textContent = snap.settings.outDirName;

  const si = snap.scanInfo;
  $('scanInfo').textContent = si
    ? `사진 ${si.files}장 (사진이 아닌 것 ${si.skipped}개 건너뜀)` + (si.capped ? ` · 한 번에 ${snap.maxFiles}장까지` : '')
    : '';

  /* 규격 */
  $('presets').innerHTML = (snap.presets || []).map((p) => `
    <label class="preset ${p.id === snap.settings.preset ? 'on' : ''}">
      <input type="radio" name="preset" value="${esc(p.id)}" ${p.id === snap.settings.preset ? 'checked' : ''}>
      <span style="min-width:0"><span class="nm">${esc(p.name)}</span><small>${esc(p.hint)}</small></span>
    </label>`).join('');
  $('customBox').hidden = snap.settings.preset !== 'custom';
  const c = snap.settings.custom;
  $('cKind').value = c.kind;
  $('cRatioW').value = c.ratioW;
  $('cRatioH').value = c.ratioH;
  $('cWidth').value = c.width;
  $('cLong').value = c.long;
  $('cTarget').value = c.targetKB;
  $('cRatioBox').hidden = c.kind !== 'id';
  $('cSizeBox').hidden = c.kind !== 'id';
  $('cLongBox').hidden = c.kind !== 'fit';

  const sp = snap.spec;
  $('specLine').textContent = sp.kind === 'fit'
    ? `긴 변 ${sp.long}px · 비율 그대로` + (sp.targetKB ? ` · ${sp.targetKB}KB 이하` : ' · 용량 안 맞춤')
    : `${sp.width} × ${Math.round(sp.width * sp.ratioH / sp.ratioW)}px (${sp.ratioW}:${sp.ratioH})`
      + (sp.targetKB ? ` · ${sp.targetKB}KB 이하` : ' · 용량 안 맞춤');

  /* 명단 */
  const r = snap.roster;
  $('rosterBadge').textContent = r.count ? `${r.count}명` : '없음';
  $('rosterBadge').className = 'badge ' + (r.count ? 'ok' : 'mute');
  $('rosterInfo').textContent = r.count
    ? `${r.source} · ${r.count}명${r.classes.length ? ' · 반 ' + r.classes.join(', ') : ''}`
    : '명단이 없으면 원래 이름 그대로 저장합니다.';
  $('selPair').value = snap.settings.pairBy;
  $('selNaming').value = snap.settings.naming;

  const gap = r.count && snap.files.length && r.count !== snap.files.length;
  $('pairWarn').hidden = !gap || snap.settings.pairBy !== 'order';
  if (gap) {
    $('pairWarn').textContent = `사진 ${snap.files.length}장, 명단 ${r.count}명 — 개수가 다릅니다.`
      + ' 순서대로 짝지으면 뒤쪽이 어긋납니다. 사진마다 이름을 확인해 주세요.';
  }

  $('ckAutoFace').checked = snap.settings.autoFace;
  $('rgHead').value = snap.settings.headRatio;
  $('rgEye').value = snap.settings.eyeLine;
  $('headEcho').textContent = Math.round(snap.settings.headRatio * 100) + '%';
  $('eyeEcho').textContent = Math.round(snap.settings.eyeLine * 100) + '%';
  $('inOutName').value = snap.settings.outDirName;

  renderGrid();
}

function renderGrid() {
  const made = shots.filter((s) => s).length;
  const okN = shots.filter((s) => s && s.ok).length;
  const noFace = shots.filter((s) => s && s.ok && s.noFace).length;
  const badN = shots.filter((s) => s && !s.ok).length;

  $('gridBadge').textContent = made ? `${okN}장 만듦` : (snap.files.length ? `사진 ${snap.files.length}장` : '아직 없음');
  $('gridBadge').className = 'badge ' + (made ? 'ok' : 'mute');

  $('filters').innerHTML = !made ? '' : [
    `<button class="chip ${filter === 'all' ? 'on' : ''}" data-f="all">전체 ${made}</button>`,
    noFace ? `<button class="chip warn ${filter === 'noface' ? 'on' : ''}" data-f="noface">얼굴 못 찾음 ${noFace}</button>` : '',
    badN ? `<button class="chip err ${filter === 'bad' ? 'on' : ''}" data-f="bad">못 연 것 ${badN}</button>` : '',
  ].filter(Boolean).join('');

  const list = shots.filter((s) => {
    if (!s) return false;
    if (filter === 'noface') return s.ok && s.noFace;
    if (filter === 'bad') return !s.ok;
    return true;
  });

  $('emptyMsg').hidden = list.length > 0;
  if (!list.length) {
    $('grid').innerHTML = '';
    $('emptyMsg').textContent = snap.files.length
      ? (made ? '이 걸러내기에 맞는 것이 없습니다.' : '[사진 만들어 보기] 를 누르세요.')
      : (snap.dir ? '사진을 찾지 못했습니다.' : '사진을 넣고 [사진 만들어 보기] 를 누르세요.');
  } else {
    const opts = (snap.roster.students || []);
    $('grid').innerHTML = list.map((s) => {
      const f = snap.files[s.index];
      const cls = !s.ok ? 'bad' : (s.noFace || s.why ? 'warn' : '');
      const tag = !s.ok ? '못 엶' : (s.noFace ? '얼굴 못 찾음' : '좋음');
      return `<div class="shot ${cls}" data-i="${s.index}">
        <div class="pic" data-slot="${s.index}">
          <span class="tag">${tag}</span>
          ${s.ok && s.blob ? `<span class="kb">${kbText(s.blob.size)}</span>` : ''}
        </div>
        <div class="who">${opts.length
    ? `<select data-pick="${s.index}">
             <option value="">(이름 없음)</option>
             ${opts.map((o) => `<option value="${esc(o.id)}" ${f.student && f.student.id === o.id ? 'selected' : ''}>${esc(o.cls ? o.cls + '-' : '')}${o.no || ''} ${esc(o.name)}</option>`).join('')}
           </select>`
    : esc(f.out)}</div>
        <div class="src">${esc(f.name)}</div>
        ${opts.length ? `<div class="out">→ ${esc(f.out)}.jpg</div>` : ''}
        ${s.why ? `<div class="why">${esc(s.why)}</div>` : ''}
        ${s.ok ? `<div class="tune">
          <button data-t="up" data-i="${s.index}" title="위로">↑</button>
          <button data-t="down" data-i="${s.index}" title="아래로">↓</button>
          <button data-t="out" data-i="${s.index}" title="작게">－</button>
          <button data-t="in" data-i="${s.index}" title="크게">＋</button>
        </div>` : ''}
      </div>`;
    }).join('');

    /* 캔버스는 innerHTML 로 못 넣으므로 자리를 만든 뒤 끼워 넣는다 */
    for (const s of list) {
      if (!s.ok || !s.canvas) continue;
      const slot = $('grid').querySelector(`[data-slot="${s.index}"]`);
      if (slot) slot.insertBefore(s.canvas, slot.firstChild);
    }
  }

  $('btnSave').disabled = !okN || busy;
  $('btnSave').textContent = busy ? '하는 중…' : (okN ? `${okN}장 ZIP 으로 받기` : '먼저 만들어 보세요');
  $('btnOpenOut').disabled = !okN || busy;
  $('btnMake').disabled = !snap.files.length || busy;
  $('btnMake').textContent = busy ? '만드는 중…' : (made ? '다시 만들기' : '사진 만들어 보기');
  $('btnRedetect').disabled = !made || busy;
}

/* ── 손보기 ───────────────────────────────────────────── */

const retune = guard(async (i, what) => {
  const s = shots[i];
  if (!s || !s.ok) return;
  if (what === 'up') s.nudgeY = (s.nudgeY || 0) - 0.04;
  else if (what === 'down') s.nudgeY = (s.nudgeY || 0) + 0.04;
  else if (what === 'in') s.zoom = Math.min(3, (s.zoom || 1) * 1.1);
  else if (what === 'out') s.zoom = Math.max(0.4, (s.zoom || 1) / 1.1);
  shots[i] = await buildShot(i, true);      // 얼굴은 다시 안 찾는다 (빠르다)
  renderGrid();
});

/* ── 단추 ─────────────────────────────────────────────── */

const pushSettings = guard(async (patch) => {
  Object.assign(snap.settings, patch);
  snap = await api('/api/settings', { settings: patch });
  render();
});

function wire() {
  /* 사진 넣기 — 폴더째 고르기 · 파일 여러 장 고르기 · 끌어다 놓기 */
  const takeFiles = (list, label) => {
    if (busy) return;
    snap = LocalApi.setFiles(Array.from(list || []), label);
    shots = [];
    render();
    if (!snap.files.length) toast('사진을 찾지 못했습니다 (JPG · PNG · WEBP · HEIC)', 'warn');
  };
  $('btnPick').onclick = () => $('pickDir').click();
  $('btnPickFiles').onclick = () => $('pickFiles').click();
  $('pickDir').onchange = (e) => {
    const fl = Array.from(e.target.files || []);
    /* 폴더째 고르면 하위 폴더 사진까지 오는데, 설치판처럼 고른 폴더 바로 안의 것만 쓴다 */
    const top = fl.filter((f) => (f.webkitRelativePath || f.name).split('/').length <= 2);
    const label = fl.length ? (fl[0].webkitRelativePath || '').split('/')[0] : '';
    takeFiles(top, label || '고른 폴더');
    e.target.value = '';
  };
  $('pickFiles').onchange = (e) => { takeFiles(e.target.files, '고른 사진'); e.target.value = ''; };

  const useRosterFile = guard(async (file) => {
    const r = await api('/api/roster', { file });
    if (!r.ok) { toast(r.message || '읽지 못했습니다', 'err'); return; }
    snap = r; render();
    toast(`${r.count}명을 읽었습니다`, 'ok');
  });

  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const fl = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    if (!fl.length) return;
    /* 명단 파일 하나를 놓았으면 명단으로 읽는다 */
    if (fl.length === 1 && /\.(xlsx|xlsm|csv|tsv|txt)$/i.test(fl[0].name)) { useRosterFile(fl[0]); return; }
    takeFiles(fl, '끌어다 놓은 사진');
  });


  $('presets').addEventListener('change', (e) => {
    const el = e.target.closest('input[name=preset]');
    if (el) pushSettings({ preset: el.value });
  });
  for (const [id, key] of [['cKind', 'kind'], ['cRatioW', 'ratioW'], ['cRatioH', 'ratioH'],
    ['cWidth', 'width'], ['cLong', 'long'], ['cTarget', 'targetKB']]) {
    $(id).onchange = (e) => {
      const custom = { ...snap.settings.custom, [key]: e.target.type === 'number' ? Number(e.target.value) : e.target.value };
      pushSettings({ custom });
    };
  }

  $('ckAutoFace').onchange = (e) => pushSettings({ autoFace: e.target.checked });
  $('rgHead').oninput = (e) => { $('headEcho').textContent = Math.round(e.target.value * 100) + '%'; };
  $('rgHead').onchange = (e) => pushSettings({ headRatio: Number(e.target.value) });
  $('rgEye').oninput = (e) => { $('eyeEcho').textContent = Math.round(e.target.value * 100) + '%'; };
  $('rgEye').onchange = (e) => pushSettings({ eyeLine: Number(e.target.value) });
  $('inOutName').onchange = (e) => pushSettings({ outDirName: e.target.value });
  $('selPair').onchange = (e) => pushSettings({ pairBy: e.target.value });
  $('selNaming').onchange = (e) => pushSettings({ naming: e.target.value });

  $('btnMake').onclick = () => makeAll(false);
  $('btnRedetect').onclick = () => makeAll(false);
  $('btnSave').onclick = saveAll;
  $('btnOpenOut').onclick = saveToFolder;
  if (typeof window.showDirectoryPicker !== 'function') $('btnOpenOut').hidden = true;

  $('filters').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    filter = c.dataset.f;
    renderGrid();
  });

  $('grid').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-t]');
    if (b) retune(Number(b.dataset.i), b.dataset.t);
  });

  $('grid').addEventListener('change', guard(async (e) => {
    const sel = e.target.closest('select[data-pick]');
    if (!sel) return;
    const r = await api('/api/repair', { index: Number(sel.dataset.pick), studentId: sel.value });
    if (!r.ok) { toast(r.message || '바꾸지 못했습니다', 'err'); return; }
    snap = r;
    renderGrid();
  }));

  /* 명단 */
  $('btnRosterPaste').onclick = guard(async () => {
    const text = $('taRoster').value;
    if (!text.trim()) { toast('붙여 넣을 명단이 없습니다', 'warn'); return; }
    const r = await api('/api/roster', { text });
    if (!r.ok) { toast(r.message || '실패', 'err'); return; }
    snap = r; $('taRoster').value = ''; render();
    toast(`${r.count}명을 읽었습니다`, 'ok');
  });
  $('btnRosterFile').onclick = () => $('pickRoster').click();
  $('pickRoster').onchange = (e) => { if (e.target.files[0]) useRosterFile(e.target.files[0]); e.target.value = ''; };
  $('btnRosterClear').onclick = guard(async () => {
    if (!confirm('명단을 비울까요?')) return;
    snap = await api('/api/roster-clear', {});
    render();
  });
}

(async function main() {
  wire();
  try { snap = await api('/api/env'); render(); }
  catch (_) {
    document.body.innerHTML = '<div style="padding:60px;text-align:center">도구를 불러오지 못했습니다. 새로 고침해 주세요.</div>';
  }
})();
