const $ = (sel) => document.querySelector(sel);

const state = {
  designs: [],
  file: null,
  outline: null,
  slideCount: 0,
  selected: null,
  pending: null,     // 파일 없이 카드를 먼저 누른 경우 기억해 둔다
  lastResult: null,
  busy: false,
};

const SAMPLE = {
  kicker: '2026 상반기',
  title: '브랜드 디자인 시스템으로\n덱을 다시 입히다',
  body: ['원본 레이아웃은 그대로 두고 색·타이포·배경만 교체합니다.', '표·차트·도형의 색 위계도 함께 정리됩니다.'],
};

/* -------------------------------------------------------------- 유틸 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (h) => `#${String(h || '000000').replace(/^#/, '')}`;

function toast(msg, isErr = false, ms = 3200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.toggle('err', isErr);
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, ms);
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function decodeReport(b64) {
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8').decode(bytes));
  } catch { return null; }
}

/* ------------------------------------------------------------ 미리보기 */

function firstTitle() {
  return state.outline?.[0]?.title || SAMPLE.title;
}

function bodyLines() {
  const b = state.outline?.[0]?.body;
  return b && b.length ? b.slice(0, 2) : SAMPLE.body;
}

/** 카드 안의 16:9 미니 슬라이드 */
function miniHtml(d) {
  const p = d.palette;
  const upper = d.titleCase === 'upper' ? 'text-transform:uppercase;' : '';
  const title = esc(firstTitle()).slice(0, 64);
  const line = esc(bodyLines()[0] || '').slice(0, 70);
  return `
    <div class="mini" style="background:${hex(p.canvas)};font-family:${d.css.bodyStack}">
      <span class="m-chip" style="background:${hex(p.accent)};color:${hex(p.onAccent)}">${esc(d.label)}</span>
      <span class="m-kicker" style="color:${hex(p.accent)}">${esc(SAMPLE.kicker)}</span>
      <p class="m-title" style="color:${hex(p.ink)};font-family:${d.css.displayStack};${upper}">${title}</p>
      <p class="m-body" style="color:${hex(p.body)}">${line}</p>
      <span class="m-bar" style="background:${hex(p.accent)}"></span>
    </div>`;
}

function cardHtml(d) {
  const p = d.palette;
  const sw = [p.canvas, p.surface, p.ink, p.body, p.hairline, p.accent]
    .map((c) => `<i style="background:${hex(c)}"></i>`).join('');
  return `
    <button class="card" data-slug="${esc(d.slug)}" aria-pressed="${state.selected === d.slug}"
            aria-label="${esc(d.label)} 스타일로 변환">
      ${miniHtml(d)}
      <div class="card-body">
        <div class="card-title">
          <h3>${esc(d.label)}</h3>
          <span class="mode">${d.dark ? '다크' : '라이트'}</span>
        </div>
        <p class="card-tag">${esc(d.tagline)}</p>
        <div class="swatches">${sw}</div>
        <div class="card-foot">
          <span class="card-cta">이 디자인으로 변환 →</span>
          <span class="card-more" data-more="${esc(d.slug)}" role="button" tabindex="0">토큰 보기</span>
        </div>
      </div>
    </button>`;
}

function renderCards() {
  $('#cards').innerHTML = state.designs.map(cardHtml).join('');
}

/** 선택 표시만 갱신 — 카드를 다시 그리면 포커스가 날아가고 깜빡인다 */
function markSelected() {
  for (const el of document.querySelectorAll('.card')) {
    el.setAttribute('aria-pressed', String(el.dataset.slug === state.selected));
  }
}

function slideHtml(d, s) {
  const p = d.palette;
  const upper = d.titleCase === 'upper' ? 'text-transform:uppercase;' : '';
  const items = (s.body || []).slice(0, 4)
    .map((t) => `<li style="color:${hex(p.body)}">${esc(t).slice(0, 110)}</li>`).join('');
  return `
    <div class="slide" style="background:${hex(p.canvas)};font-family:${d.css.bodyStack}">
      <span class="s-num" style="color:${hex(p.muted)}">${s.index}</span>
      <p class="s-title" style="color:${hex(p.ink)};font-family:${d.css.displayStack};${upper}">${esc(s.title).slice(0, 90)}</p>
      <ul class="s-list">${items}</ul>
      ${d.signature !== 'none' ? `<span class="s-bar" style="background:${hex(p.accent)}"></span>` : ''}
    </div>`;
}

function renderPreview(d) {
  if (!state.outline?.length) { $('#preview-wrap').hidden = true; return; }
  $('#preview').innerHTML = state.outline.slice(0, 6).map((s) => slideHtml(d, s)).join('');
  $('#preview-wrap').hidden = false;
}

/* ------------------------------------------------------------ 업로드 */

async function analyze(file) {
  const res = await fetch('/api/analyze', { method: 'POST', body: file });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || '파일을 분석할 수 없습니다.');
  }
  return res.json();
}

async function setFile(file) {
  if (!file) return;
  if (!/\.pptx$/i.test(file.name)) {
    toast('.pptx 파일만 지원합니다. 예전 .ppt 는 파워포인트에서 "다른 이름으로 저장 → .pptx" 후 올려주세요.', true, 6000);
    return;
  }
  state.file = file;
  state.outline = null;
  state.slideCount = 0;

  $('#drop').classList.add('has-file');
  $('.drop-inner').hidden = true;
  $('#file-info').hidden = false;
  $('#file-name').textContent = file.name;
  $('#file-sub').textContent = `${fmtBytes(file.size)} · 슬라이드 분석 중…`;

  try {
    const info = await analyze(file);
    state.outline = info.outline;
    state.slideCount = info.slideCount;
    $('#file-sub').textContent = `${fmtBytes(file.size)} · 슬라이드 ${info.slideCount}장`;
    renderCards();
    if (state.selected) renderPreview(state.designs.find((d) => d.slug === state.selected));
  } catch (err) {
    $('#file-sub').textContent = `${fmtBytes(file.size)} · 분석 실패`;
    toast(err.message, true, 6000);
    return;
  }

  if (state.pending) {
    const slug = state.pending;
    state.pending = null;
    convert(slug);
  } else {
    toast('파일 준비 완료 — 원하는 디자인 카드를 눌러주세요.');
  }
}

function clearFile() {
  state.file = null;
  state.outline = null;
  state.slideCount = 0;
  $('#file').value = '';
  $('#drop').classList.remove('has-file');
  $('.drop-inner').hidden = false;
  $('#file-info').hidden = true;
  $('#preview-wrap').hidden = true;
  renderCards();
}

/* ------------------------------------------------------------ 변환 */

function readOptions() {
  const b = (id) => ($(id).checked ? '1' : '0');
  const q = new URLSearchParams({
    recolorText: b('#opt-recolorText'),
    recolorFills: b('#opt-recolorFills'),
    forceBackground: b('#opt-forceBackground'),
    keepBackgroundImages: b('#opt-keepBackgroundImages'),
    changeFonts: b('#opt-changeFonts'),
    brandFontFirst: b('#opt-brandFontFirst'),
    signature: b('#opt-signature'),
    uppercaseTitles: $('#opt-uppercaseTitles').value,
    koreanFont: $('#opt-koreanFont').value,
  });
  return q;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function outName(slug) {
  const base = (state.file?.name || 'presentation').replace(/\.pptx?$/i, '');
  return `${base}__${slug}.pptx`;
}

function showBusy(d) {
  $('#result-step').hidden = false;
  $('#result').classList.add('busy');
  $('#result').innerHTML = `<h3><span class="spinner"></span>${esc(d.label)} 스타일로 변환 중…</h3>
    <p class="sub">슬라이드 ${state.slideCount}장의 테마·배경·도형 색과 폰트를 재매핑하고 있습니다.</p>`;
  $('#result-step').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showResult(d, report, blob) {
  const s = report || {};
  const stats = [
    ['슬라이드', s.slides], ['레이아웃', s.layouts], ['마스터', s.masters], ['테마', s.themes],
    ['색상 재매핑', s.colors], ['폰트 적용', s.fonts], ['배경 교체', s.backgrounds],
  ].filter(([, v]) => typeof v === 'number' && v > 0)
    .map(([k, v]) => `<span class="stat">${k} <b>${v.toLocaleString()}</b></span>`).join('');

  const warn = s.skipped?.length
    ? `<p class="sub" style="margin-top:10px"><span class="err">주의</span> 다음 파트는 원본 그대로 유지했습니다: ${esc(s.skipped.slice(0, 5).join(', '))}</p>`
    : '';

  $('#result').classList.remove('busy');
  $('#result').innerHTML = `
    <h3>✓ ${esc(d.label)} 스타일로 변환 완료 <span class="hint">(${s.ms ?? 0}ms · ${fmtBytes(blob.size)})</span></h3>
    <p class="sub">다운로드가 시작되었습니다. 파일명: <b>${esc(outName(d.slug))}</b></p>
    <div class="stats">${stats}</div>
    ${warn}
    <div class="actions">
      <button class="primary" id="btn-redownload">다시 다운로드</button>
      <button class="ghost" id="btn-other">다른 디자인으로 변환</button>
    </div>`;

  $('#btn-redownload').onclick = () => download(blob, outName(d.slug));
  $('#btn-other').onclick = () => $('#cards').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function convert(slug) {
  const d = state.designs.find((x) => x.slug === slug);
  if (!d) return;

  state.selected = slug;
  markSelected();
  renderPreview(d);

  if (!state.file) {
    state.pending = slug;
    toast(`${d.label} 선택됨 — PPT 파일을 올리면 바로 변환됩니다.`);
    $('#drop').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (state.busy) return;

  state.busy = true;
  const card = document.querySelector(`.card[data-slug="${slug}"]`);
  card?.classList.add('busy');
  showBusy(d);

  try {
    const q = readOptions();
    q.set('design', slug);
    q.set('name', state.file.name);
    const res = await fetch(`/api/convert?${q}`, { method: 'POST', body: state.file });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `변환 실패 (HTTP ${res.status})`);
    }
    const report = decodeReport(res.headers.get('X-Restyle-Report'));
    const blob = await res.blob();
    state.lastResult = { slug, blob };
    download(blob, outName(slug));
    showResult(d, report, blob);
  } catch (err) {
    $('#result').classList.remove('busy');
    $('#result').innerHTML = `<h3 class="err">변환에 실패했습니다</h3><p class="sub">${esc(err.message)}</p>`;
  } finally {
    state.busy = false;
    card?.classList.remove('busy');
  }
}

/* ------------------------------------------------------------- 모달 */

async function openDetails(slug) {
  const res = await fetch(`/api/designs/${encodeURIComponent(slug)}`);
  if (!res.ok) return toast('디자인 정보를 불러오지 못했습니다.', true);
  const d = await res.json();
  const p = d.palette;
  const toks = [
    ['canvas', p.canvas, '슬라이드 배경'], ['surface', p.surface, '카드/박스 면'],
    ['ink', p.ink, '제목 글자'], ['body', p.body, '본문 글자'],
    ['hairline', p.hairline, '선/구분선'], ['accent', p.accent, '강조색'],
  ].map(([k, c, label]) => `
    <div class="tok"><div class="chip" style="background:${hex(c)}"></div>
      <div class="lab"><b>${label}</b><code>${esc(k)} · ${hex(c).toUpperCase()}</code></div></div>`).join('');
  const ramp = p.accentRamp.map((c) => `
    <div class="tok"><div class="chip" style="background:${hex(c)}"></div>
      <div class="lab"><code>${hex(c).toUpperCase()}</code></div></div>`).join('');

  $('#modal-body').innerHTML = `
    <h2>${esc(d.label)}</h2>
    <div class="m-file">${esc(d.file)} · ${esc(d.name)}</div>
    <p class="desc">${esc(d.description)}</p>
    <h4>핵심 토큰</h4><div class="tok-grid">${toks}</div>
    <h4>테마 강조색 (accent1–6 으로 주입)</h4><div class="tok-grid">${ramp}</div>
    <h4>PPT 적용 폰트</h4>
    <div class="kv">
      <b>제목</b><span>${esc(d.fonts.major)} <span class="hint">(브랜드: ${esc(d.fonts.brandMajor || '-')})</span></span>
      <b>본문</b><span>${esc(d.fonts.minor)} <span class="hint">(브랜드: ${esc(d.fonts.brandMinor || '-')})</span></span>
      <b>제목 대문자</b><span>${d.titleCase === 'upper' ? '적용' : '미적용'}</span>
      <b>시그니처</b><span>${d.signature === 'tricolor' ? 'M 트리컬러 스트라이프' : d.signature === 'bar' ? '강조 바' : '없음'}</span>
    </div>`;
  $('#modal').hidden = false;
}

/* -------------------------------------------------------------- 이벤트 */

function bind() {
  const drop = $('#drop');
  drop.addEventListener('click', (e) => {
    if (e.target.closest('#btn-clear') || e.target.closest('#btn-sample')) return;
    if (!state.file) $('#file').click();
  });
  $('#btn-sample').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/sample');
      const blob = await res.blob();
      await setFile(new File([blob], '샘플_사업보고.pptx', { type: blob.type }));
    } catch {
      toast('샘플 덱을 불러오지 못했습니다.', true);
    }
  });
  drop.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !state.file) { e.preventDefault(); $('#file').click(); }
  });
  $('#file').addEventListener('change', (e) => setFile(e.target.files?.[0]));
  $('#btn-clear').addEventListener('click', (e) => { e.stopPropagation(); clearFile(); });

  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => setFile(e.dataTransfer?.files?.[0]));
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  $('#cards').addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    if (more) { e.stopPropagation(); return openDetails(more.dataset.more); }
    const card = e.target.closest('.card');
    if (card) convert(card.dataset.slug);
  });
  $('#cards').addEventListener('keydown', (e) => {
    const more = e.target.closest('[data-more]');
    if (more && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); openDetails(more.dataset.more); }
  });

  $('#modal-close').addEventListener('click', () => { $('#modal').hidden = true; });
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#modal').hidden = true; });

  $('#btn-reload').addEventListener('click', async () => {
    const res = await fetch('/api/reload', { method: 'POST' });
    const j = await res.json();
    state.designs = j.designs;
    renderCards();
    toast(`디자인 ${j.designs.length}개 다시 읽었습니다.`);
  });
}

async function init() {
  bind();
  try {
    const res = await fetch('/api/designs');
    const j = await res.json();
    state.designs = j.designs || [];
    renderCards();
    if (!state.designs.length) toast('DESIGN-*.md 파일을 찾지 못했습니다.', true, 6000);
  } catch {
    toast('디자인 목록을 불러오지 못했습니다. 새로 고침해 주세요.', true, 6000);
  }
}

init();
