/* 문서 뷰어 — 본체.
 * 파일 열기(고르기·끌어 놓기·붙여 넣기·주소·앱 연결·구글 드라이브) → 형식 알아내기 → 형식별 렌더러에 맡기기.
 * 위 막대: 쪽 이동·확대·돌리기·찾기·인쇄·메일·내려받기·전체 화면·정보. */
import { $, el, extOf, formatSize, downloadBlob, nextFrame } from './util.js';
import { classify, KIND_LABEL } from './format.js';

/* 구글 앱스 스크립트 판(드라이브에서 열기·메일에 바로 첨부) 주소. 배포 후 채운다. */
const GAS_URL = '';

const RENDER = {
  pdf: ['pdf', 'render'], hwp: ['hwp', 'render'], hwp3: ['hwp', 'render'], hwpx: ['hwp', 'render'],
  docx: ['docx', 'render'], doc: ['legacy', 'render'], ppt: ['legacy', 'render'], rtf: ['legacy', 'render'],
  xlsx: ['sheet', 'render'], xls: ['sheet', 'render'], ods: ['sheet', 'render'], csv: ['sheet', 'render'],
  pptx: ['pptx', 'render'], odt: ['odf', 'render'], odp: ['odf', 'render'], epub: ['epub', 'render'],
  image: ['image', 'render'], text: ['text', 'renderText'], markdown: ['text', 'renderMarkdown'],
  html: ['text', 'renderHtml'], notebook: ['text', 'renderNotebook'],
  media: ['misc', 'renderMedia'], font: ['misc', 'renderFont'], zip: ['misc', 'renderZip'],
  pages: ['misc', 'renderZip'], numbers: ['misc', 'renderZip'], keynote: ['misc', 'renderZip'],
  cfb: ['misc', 'renderUnknown'], unknown: ['misc', 'renderUnknown'],
};

const LABEL = Object.assign({}, KIND_LABEL, {
  markdown: '마크다운', html: 'HTML 웹 문서', notebook: '주피터 노트북', media: '소리·영상', font: '글꼴',
});

const BADGE = {
  pdf: 'k-pdf', hwp: 'k-hwp', hwp3: 'k-hwp', hwpx: 'k-hwp', docx: 'k-doc', doc: 'k-doc', rtf: 'k-doc',
  xlsx: 'k-xls', xls: 'k-xls', ods: 'k-xls', csv: 'k-xls', pptx: 'k-ppt', ppt: 'k-ppt', odt: 'k-odf', odp: 'k-odf',
  epub: 'k-odf', image: 'k-img', text: 'k-txt', markdown: 'k-txt', html: 'k-txt', notebook: 'k-txt',
  media: 'k-media', font: 'k-txt', zip: 'k-zip', pages: 'k-doc', numbers: 'k-xls', keynote: 'k-ppt',
};

const FORMATS = [
  { k: 'HWP', cls: 'k-hwp', name: '한글', ext: 'hwp · hwpx · hwp 3.0 · hml', desc: '쪽 모양 그대로 — 표·그림·수식·머리말까지. 암호 문서도 엽니다.' },
  { k: 'PDF', cls: 'k-pdf', name: 'PDF', ext: 'pdf', desc: '글자 선택·복사·찾기, 문서 안 링크. 암호 PDF 도 엽니다.' },
  { k: 'DOC', cls: 'k-doc', name: '워드', ext: 'docx · doc · rtf', desc: 'docx 는 쪽 모양 그대로, 옛 doc·rtf 는 글을 꺼내 보여 줍니다.' },
  { k: 'XLS', cls: 'k-xls', name: '엑셀·표', ext: 'xlsx · xls · ods · csv · tsv', desc: '시트별 보기, 병합 칸 그대로. 한글 CSV 도 깨지지 않게.' },
  { k: 'PPT', cls: 'k-ppt', name: '파워포인트', ext: 'pptx · ppt', desc: 'pptx 는 슬라이드 모양 그대로, 옛 ppt 는 글과 그림을.' },
  { k: 'ODT', cls: 'k-odf', name: 'ODF · 공문 본문', ext: 'odt · odp · ods', desc: '업무관리시스템에서 받은 본문 .odt 를 표·그림과 함께.' },
  { k: 'IMG', cls: 'k-img', name: '그림', ext: 'jpg · png · gif · webp · bmp · heic · tiff · svg · avif', desc: '아이폰 사진(HEIC)·여러 쪽 TIFF 도. 돌리기·확대.' },
  { k: 'MD', cls: 'k-txt', name: '마크다운·텍스트', ext: 'md · txt · json · xml · yaml · log …', desc: '수식(LaTeX)·코드 색칠. 한글 인코딩(CP949) 자동 판별.' },
  { k: 'CODE', cls: 'k-txt', name: '코드·웹·노트북', ext: 'py · js · java · c · html · ipynb …', desc: 'HTML 은 스크립트를 막고 안전하게, 노트북은 실행 결과까지.' },
  { k: 'EPUB', cls: 'k-odf', name: '전자책', ext: 'epub', desc: '장 순서대로 이어서 읽기.' },
  { k: 'AV', cls: 'k-media', name: '소리·영상·글꼴', ext: 'mp3 · mp4 · wav · webm · ttf · otf …', desc: '바로 재생, 글꼴은 보기 글로 미리 보기.' },
  { k: 'ZIP', cls: 'k-zip', name: '압축 파일', ext: 'zip (한글 파일 이름)', desc: '풀지 않고 안에 든 파일을 하나씩 열어 봅니다.' },
];

const state = {
  docs: [], active: null, res: null, view: null, seq: 0, uid: 0,
  find: { q: '', hits: null, idx: -1, total: 0 },
  bridge: null, user: null, installPrompt: null, sideAuto: false,
};

/* ================================================================ 작은 도우미 */

let toastTimer = null;
function toast(msg, ms) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms || 3200);
}

function busy(msg) {
  $('busy').hidden = msg == null;
  if (msg != null) $('busyMsg').textContent = msg;
}

function showNote(msg) {
  $('noteText').textContent = msg;
  $('note').hidden = !msg;
}

function badgeText(doc) {
  const k = doc.kind;
  const ext = extOf(doc.name).toUpperCase();
  if (k === 'image' || k === 'text' || k === 'media' || k === 'font') return (ext || k.toUpperCase()).slice(0, 5);
  if (k === 'hwp3') return 'HWP3';
  if (k === 'markdown') return 'MD';
  if (k === 'notebook') return 'IPYNB';
  if (k === 'unknown' || k === 'cfb' || !k) return ext ? ext.slice(0, 5) : '?';
  return k.toUpperCase();
}

const mm = (px) => Math.round(px / 96 * 25.4 * 10) / 10;

/* ================================================================ 파일 들이기 */

function addDoc(o) {
  const doc = {
    id: ++state.uid,
    name: o.name || '이름 없는 파일',
    size: o.size != null ? o.size : (o.bytes ? o.bytes.length : 0),
    type: o.type || '',
    lastModified: o.lastModified || null,
    file: o.file || null,
    bytes: o.bytes || null,
    parent: o.parent || null,
    kind: null,
    viewState: null,
  };
  state.docs.push(doc);
  return doc;
}

export function openFiles(list) {
  const files = [...(list || [])].filter(Boolean);
  if (!files.length) return;
  let first = null;
  for (const f of files) {
    const name = f.name || ('붙여 넣은 ' + (f.type && f.type.startsWith('image/') ? '그림.' + f.type.split('/')[1] : '파일'));
    const d = addDoc({ name, size: f.size, type: f.type, lastModified: f.lastModified, file: f });
    if (!first) first = d;
  }
  if (state.docs.length >= 2 && !state.sideAuto && window.innerWidth > 900) { state.sideAuto = true; toggleSide(true); }
  renderSide();
  activate(first);
}

async function readBytes(doc) {
  if (doc.bytes) return doc.bytes;
  doc.bytes = new Uint8Array(await doc.file.arrayBuffer());
  doc.size = doc.bytes.length;
  return doc.bytes;
}

function resolveKind(doc) {
  const ext = extOf(doc.name);
  const c = classify(doc.bytes, doc.name);
  doc.reason = c.reason;
  let k = c.kind;
  if (k === 'text' || k === 'unknown' || k === 'csv') {
    if (['md', 'markdown', 'mdown', 'mkd', 'mdx'].includes(ext)) return 'markdown';
    if (['html', 'htm', 'xhtml', 'shtml'].includes(ext)) return 'html';
    if (ext === 'ipynb') return 'notebook';
    if (ext === 'svg') return 'image';
    if (ext === 'hml') return 'hwp';
    if (ext === 'csv' || ext === 'tsv') return 'csv';
    if (ext === 'rtf') return 'rtf';
    if (ext === 'eml' || ext === 'mht' || ext === 'mhtml') return 'text';
  }
  if (k === 'unknown') {
    if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'weba', 'mp4', 'm4v', 'webm', 'ogv', 'mov', 'mkv', '3gp', 'wma', 'avi', 'wmv', 'amr'].includes(ext)) return 'media';
    if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return 'font';
    if (['ico', 'cur', 'avif', 'heic', 'heif', 'svg', 'jfif'].includes(ext)) return 'image';
    if (ext === 'hml') return 'hwp';
  }
  return k;
}

/* ================================================================ 보이기 */

function makeCtx(doc, token) {
  const live = () => token === state.seq;
  return {
    progress: (msg) => { if (live()) busy(msg); },
    askPassword: (tip) => askPassword(tip),
    pagedOpts: (o) => Object.assign({}, o, { onPage: (i) => live() && updatePage(i), onZoom: (s, m) => live() && updateZoom(s, m) }),
    flowOpts: (o) => Object.assign({}, o, { onPage: (i) => live() && updatePage(i), onZoom: (s, m) => live() && updateZoom(s, m) }),
    openChild: (o) => {
      const d = addDoc({ name: o.name, bytes: o.bytes, size: o.bytes.length, lastModified: o.date ? +o.date : null, parent: doc.name });
      if (window.innerWidth > 900) toggleSide(true);
      renderSide();
      activate(d);
    },
    reopenAs: (kind) => activate(doc, { kind, force: true }),
    changed: () => live() && updateTools(),
  };
}

function destroyView() {
  const res = state.res;
  state.res = null;
  state.view = null;
  if (!res) return;
  try { if (res.onDestroy) res.onDestroy(); } catch (_) {}
  try { (res.paged || res.flow).destroy(); } catch (_) {}
}

function saveViewState() {
  const d = state.active, v = state.view;
  if (!d || !v) return;
  d.viewState = { page: v.cur || 0, mode: v.mode, top: (v.root && v.root.scrollTop) || 0 };
}

async function activate(doc, opts) {
  opts = opts || {};
  if (!doc) return showEmpty();
  if (state.active === doc && state.res && !opts.force) return;
  saveViewState();
  destroyView();
  closeFind();
  showNote('');
  state.active = doc;
  if (opts.kind) doc.kind = opts.kind;
  const token = ++state.seq;
  $('empty').hidden = true;
  const viewer = $('viewer');
  viewer.hidden = false;
  viewer.innerHTML = '';
  document.body.classList.add('doc-open');
  renderSide();
  updateTitle();
  updateTools();
  busy('여는 중…');
  try {
    await readBytes(doc);
    if (!doc.kind) doc.kind = resolveKind(doc);
    if (token !== state.seq) return;
    updateTitle();
    renderSide();
    const [mod, fn] = RENDER[doc.kind] || RENDER.unknown;
    const m = await import(`./r/${mod}.js`);
    if (token !== state.seq) return;
    const res = await m[fn](doc, viewer, makeCtx(doc, token));
    if (token !== state.seq) {
      try { if (res.onDestroy) res.onDestroy(); (res.paged || res.flow).destroy(); } catch (_) {}
      return;
    }
    state.res = res;
    state.view = res.paged || res.flow;
    const vs = doc.viewState;
    if (vs && state.view) {
      if (vs.mode != null && vs.mode !== state.view.mode) state.view.setZoom(vs.mode);
      if (res.paged && vs.page) state.view.goTo(vs.page, true);
      else if (vs.top && state.view.root) state.view.root.scrollTop = vs.top;
    }
    if (res.note) showNote(res.note);
    updateTools();
    if (state.view) {
      updatePage(state.view.cur || 0);
      updateZoom(state.view.scale, state.view.mode);
      if (state.view.root) state.view.root.tabIndex = -1;
    }
  } catch (e) {
    if (token !== state.seq) return;
    console.error(e);
    showError(doc, e);
  } finally {
    if (token === state.seq) busy(null);
  }
}

function showError(doc, e) {
  const viewer = $('viewer');
  viewer.innerHTML = '';
  viewer.appendChild(el('div', { class: 'error-card' },
    el('h2', { text: '이 파일을 보여 주지 못했습니다' }),
    el('p', { text: String((e && e.message) || e) }),
    el('div', { class: 'row center' },
      doc.kind !== 'text' ? el('button', { type: 'button', class: 'btn', onclick: () => activate(doc, { kind: 'text', force: true }) }, '글자로 열어 보기') : null,
      el('button', { type: 'button', class: 'btn', onclick: () => downloadDoc(doc) }, '원본 내려받기'))));
  updateTools();
}

function showEmpty() {
  destroyView();
  closeFind();
  showNote('');
  state.active = null;
  $('viewer').hidden = true;
  $('viewer').innerHTML = '';
  $('empty').hidden = false;
  document.body.classList.remove('doc-open');
  updateTitle();
  updateTools();
  renderSide();
}

function closeDoc(doc) {
  const i = state.docs.indexOf(doc);
  if (i < 0) return;
  state.docs.splice(i, 1);
  doc.bytes = null; doc.file = null;
  if (state.active === doc) {
    state.active = null;
    const next = state.docs[i] || state.docs[i - 1];
    if (next) activate(next); else showEmpty();
  }
  renderSide();
}

/* ================================================================ 막대·목록 갱신 */

function updateTitle() {
  const d = state.active;
  $('docTitle').hidden = !d;
  if (!d) { document.title = '문서 뷰어'; return; }
  $('docName').textContent = d.name;
  $('docName').title = d.parent ? `${d.parent} › ${d.name}` : d.name;
  $('docKind').textContent = d.kind ? (LABEL[d.kind] || d.kind) : '…';
  document.title = d.name + ' · 문서 뷰어';
}

function renderSide() {
  const ul = $('fileList');
  ul.innerHTML = '';
  for (const d of state.docs) {
    const li = el('li', { 'aria-current': d === state.active ? 'true' : 'false', title: d.parent ? `${d.parent} › ${d.name}` : d.name, onclick: () => activate(d) },
      el('span', { class: 'fk ' + (BADGE[d.kind] || ''), text: d.kind ? badgeText(d) : (extOf(d.name).toUpperCase().slice(0, 5) || '?') }),
      el('span', { class: 'fmeta' }, el('span', { class: 'fn', text: d.name }), el('small', { text: formatSize(d.size) + (d.parent ? ' · ' + d.parent : '') })),
      el('button', { class: 'ib small x', type: 'button', title: '닫기', 'aria-label': d.name + ' 닫기', onclick: (e) => { e.stopPropagation(); closeDoc(d); } },
        svgUse('i-x')));
    ul.appendChild(li);
  }
  const n = state.docs.length;
  $('sideCount').hidden = n < 2;
  $('sideCount').textContent = n;
}

function svgUse(id) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'i');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', '#' + id);
  s.appendChild(u);
  return s;
}

function toggleSide(force) {
  const side = $('side');
  const open = force != null ? force : side.hidden;
  side.hidden = !open;
  $('btnSide').setAttribute('aria-expanded', String(open));
}

function updateTools() {
  const d = state.active, res = state.res, v = state.view;
  $('tools').hidden = !d;
  const pages = v && v.pageCount ? v.pageCount : 0;
  $('grpPage').hidden = !(pages > 1);
  $('pageTotal').textContent = pages;
  $('grpZoom').hidden = !v || (res && res.noZoom) || (d && d.kind === 'media');
  $('btnRotate').hidden = !(v && v.rotatable);
  $('btnFind').hidden = !(v && v.searchable) || (d && (d.kind === 'html' || d.kind === 'media'));
  $('btnPrint').disabled = !res || !!res.noPrint;
  document.querySelectorAll('.menu .need-doc').forEach((b) => { b.disabled = !d; });
  const canTab = d && (d.kind === 'pdf' || d.kind === 'media' || (d.kind === 'image' && !/svg/i.test(extOf(d.name))));
  $('miNewTab').hidden = !canTab;
  $('miShare').hidden = !(d && canShareDoc(d));
}

function updatePage(i) {
  const inp = $('pageInput');
  if (document.activeElement !== inp) inp.value = (i | 0) + 1;
  $('btnPrev').disabled = i <= 0;
  const v = state.view;
  $('btnNext').disabled = v ? i >= v.pageCount - 1 : true;
}

function updateZoom(scale, mode) {
  const pct = Math.round((scale || 1) * 100) + '%';
  const names = { width: '폭 맞춤', page: '쪽 맞춤', auto: '자동', fit: '화면 맞춤' };
  $('zoomCur').textContent = typeof mode === 'string' ? `${names[mode] || mode} ${pct}` : pct;
  $('zoomSel').value = 'cur';
}

/* ================================================================ 찾기 */

function openFind() {
  if (!state.view || $('btnFind').hidden) return false;
  $('findbar').hidden = false;
  const inp = $('findInput');
  inp.focus();
  inp.select();
  return true;
}

function closeFind() {
  $('findbar').hidden = true;
  $('findCount').textContent = '';
  state.find = { q: '', hits: null, idx: -1, total: 0 };
  try { state.view && state.view.clearSearch && state.view.clearSearch(); } catch (_) {}
}

async function runFind(dir) {
  const q = $('findInput').value.trim();
  const v = state.view, res = state.res;
  const out = $('findCount');
  if (!v || !q) { out.textContent = ''; if (v && v.clearSearch) v.clearSearch(); state.find.q = ''; return; }
  const f = state.find;
  if (q !== f.q) {
    f.q = q; f.idx = -1;
    if (res.paged) {
      out.textContent = '찾는 중…';
      const myQ = q;
      const hits = await v.search(q, (n, t) => { if (f.q === myQ) out.textContent = `찾는 중… ${n}/${t}쪽`; });
      if (f.q !== myQ) return;
      f.hits = hits;
      f.total = hits.reduce((s, h) => s + h.count, 0);
    } else {
      f.hits = v.search(q);
    }
  }
  if (res.paged) {
    const hits = f.hits || [];
    if (!hits.length) { out.textContent = '찾는 글이 없습니다'; return; }
    f.idx = (f.idx + dir + hits.length) % hits.length;
    if (f.idx < 0) f.idx = 0;
    const h = hits[f.idx];
    v.goTo(h.page);
    out.textContent = `${h.page + 1}쪽에 ${h.count}곳 · ${f.idx + 1}/${hits.length}쪽 (모두 ${f.total}곳)`;
  } else {
    const n = f.hits || 0;
    if (!n) { out.textContent = '찾는 글이 없습니다'; return; }
    const pos = v.findGo(dir);
    out.textContent = `${pos} / ${n}`;
  }
}

/* ================================================================ 인쇄 */

function pageStyle(css) {
  let s = $('pageStyle');
  if (!s) { s = el('style', { id: 'pageStyle' }); document.head.appendChild(s); }
  s.textContent = css || '';
}

function cleanupPrint() {
  document.body.classList.remove('print-paged', 'print-flow');
  const root = $('printRoot');
  root.querySelectorAll('img').forEach((im) => { if (im.src.startsWith('blob:')) URL.revokeObjectURL(im.src); });
  root.innerHTML = '';
  pageStyle('');
}

async function doPrint() {
  const d = state.active, res = state.res;
  if (!d || !res) return;
  if (res.noPrint) { toast('이 파일은 인쇄할 수 없습니다.'); return; }
  closeMenu();
  if (res.printFrame) {
    try { res.printFrame.contentWindow.focus(); res.printFrame.contentWindow.print(); return; } catch (_) { /* 아래 방식으로 */ }
  }
  cleanupPrint();
  if (res.paged) {
    busy('인쇄할 쪽을 준비하는 중…');
    try {
      const items = await res.paged.printItems((i, n) => busy(`인쇄할 쪽을 준비하는 중… ${i + 1}/${n}`));
      const root = $('printRoot');
      for (const it of items) root.appendChild(el('div', { class: 'print-page' }, it.node));
      await Promise.all([...root.querySelectorAll('img')].map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
      const s = items[0] && items[0].size;
      pageStyle(s ? `@page { size: ${mm(s.w)}mm ${mm(s.h)}mm; margin: 0; }` : '@page { margin: 0; }');
      document.body.classList.add('print-paged');
    } catch (e) {
      busy(null);
      toast('인쇄 준비에 실패했습니다: ' + e.message);
      cleanupPrint();
      return;
    }
    busy(null);
  } else {
    pageStyle(res.printCss || '@page { margin: 14mm; }');
    document.body.classList.add('print-flow');
  }
  await nextFrame();
  window.addEventListener('afterprint', cleanupPrint, { once: true });
  window.print();
  setTimeout(() => { if (!matchMedia('print').matches) cleanupPrint(); }, 1500);
}

/* ================================================================ 내려받기·공유·메일 */

function docBlob(doc) {
  return new Blob([doc.bytes], { type: doc.type || 'application/octet-stream' });
}

function downloadDoc(doc) {
  doc = doc || state.active;
  if (!doc || !doc.bytes) return;
  downloadBlob(docBlob(doc), doc.name);
}

function canShareDoc(doc) {
  try {
    if (!navigator.canShare || !doc.bytes) return false;
    return navigator.canShare({ files: [new File([doc.bytes.subarray(0, 1)], doc.name, { type: doc.type || 'application/octet-stream' })] });
  } catch (_) { return false; }
}

async function shareDoc() {
  const d = state.active;
  if (!d) return;
  try {
    await navigator.share({ files: [new File([d.bytes], d.name, { type: d.type || 'application/octet-stream' })], title: d.name });
  } catch (e) {
    if (e && e.name !== 'AbortError') toast('공유하지 못했습니다: ' + e.message);
  }
}

function openMail() {
  const d = state.active;
  if (!d) return;
  closeMenu();
  $('mailFile').textContent = `📎 ${d.name} · ${formatSize(d.size)}`;
  const direct = !!(state.bridge && state.bridge.ready);
  $('mailDirect').hidden = !direct;
  $('mailWeb').hidden = direct;
  $('mailMsg').textContent = '';
  $('mailMsg').className = 'msg';
  $('mailSend').disabled = false;
  if (direct) {
    $('mailSubject').value = d.name;
    if (!$('mailBody').value) $('mailBody').value = '첨부한 파일을 보내 드립니다.';
    $('mailFrom').textContent = state.user ? `보내는 사람: ${state.user} (내 구글 계정으로 보냅니다 · 25MB 까지)` : '내 구글 계정으로 보냅니다 (25MB 까지).';
  } else {
    $('mailShare').hidden = !canShareDoc(d);
    $('gasHint').textContent = GAS_URL ? '구글 앱판에서는 내 Gmail 로 바로 첨부해 보낼 수 있습니다.' : '';
    if (GAS_URL) $('gasHint').appendChild(el('a', { href: GAS_URL, target: '_blank', rel: 'noopener' }, ' 구글 앱판 열기'));
  }
  $('dlgMail').showModal();
  if (direct) setTimeout(() => $('mailTo').focus(), 50);
}

async function sendMailDirect() {
  const d = state.active;
  const to = $('mailTo').value.trim();
  const msg = $('mailMsg');
  if (!to || !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+(\s*,\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+)*$/.test(to)) {
    msg.textContent = '받는 사람 메일 주소를 바르게 적어 주세요. (여러 명은 쉼표로)';
    msg.className = 'msg err';
    return;
  }
  if (d.size > 24 * 1024 * 1024) {
    msg.textContent = '메일에는 25MB 까지만 첨부할 수 있습니다. 드라이브 링크로 공유해 주세요.';
    msg.className = 'msg err';
    return;
  }
  $('mailSend').disabled = true;
  msg.textContent = '보내는 중…';
  msg.className = 'msg';
  try {
    const buf = d.bytes.slice().buffer;
    const r = await state.bridge.call('mail', {
      to, subject: $('mailSubject').value.trim() || d.name, body: $('mailBody').value,
      file: { name: d.name, mime: d.type || 'application/octet-stream', bytes: buf },
    }, [buf], 120000);
    if (!r.ok) throw new Error(r.error || '보내지 못했습니다');
    msg.textContent = `보냈습니다 → ${to}` + (r.remaining != null ? ` (오늘 더 보낼 수 있는 메일: ${r.remaining}통)` : '');
    msg.className = 'msg ok';
  } catch (e) {
    msg.textContent = '보내지 못했습니다: ' + e.message;
    msg.className = 'msg err';
    $('mailSend').disabled = false;
  }
}

function clickLink(href) {
  const a = el('a', { href, target: '_blank', rel: 'noopener' });
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ================================================================ 정보·형식 */

function openInfo() {
  const d = state.active;
  if (!d) return;
  closeMenu();
  const rows = [
    ['파일 이름', d.name],
    d.parent ? ['들어 있던 곳', d.parent] : null,
    ['형식', (LABEL[d.kind] || d.kind || '알 수 없음') + (d.reason ? ` — ${d.reason}` : '')],
    ['크기', `${formatSize(d.size)} (${(d.size || 0).toLocaleString()} 바이트)`],
    d.lastModified ? ['고친 날', new Date(d.lastModified).toLocaleString('ko-KR')] : null,
  ].filter(Boolean).concat((state.res && state.res.info) || []);
  const t = $('infoTable');
  t.innerHTML = '';
  for (const [k, v] of rows) t.appendChild(el('tr', null, el('th', { text: k }), el('td', { text: v })));
  $('dlgInfo').showModal();
}

function renderFormats() {
  const box = $('formats');
  box.innerHTML = '';
  for (const f of FORMATS) {
    box.appendChild(el('div', { class: 'fmt' }, el('span', { class: 'fk ' + f.cls, text: f.k }),
      el('span', null, el('b', { text: f.name }), el('small', { text: f.ext }), el('small', { text: f.desc }))));
  }
  const tb = el('table', { class: 'fmt-table' }, el('thead', null, el('tr', null, el('th', { text: '종류' }), el('th', { text: '확장자' }), el('th', { text: '보여 주는 방식' }))));
  const body = el('tbody');
  for (const f of FORMATS) body.appendChild(el('tr', null, el('th', { text: f.name }), el('td', { text: f.ext }), el('td', { text: f.desc })));
  body.appendChild(el('tr', null, el('th', { text: '그 밖' }), el('td', { text: '모든 파일' }), el('td', { text: '형식을 모르면 앞부분 바이트와 함께 글자로 열어 보기를 제공합니다.' })));
  tb.appendChild(body);
  $('fmtTable').innerHTML = '';
  $('fmtTable').appendChild(tb);
}

/* ================================================================ 암호 */

function askPassword(tip) {
  return new Promise((resolve) => {
    const dlg = $('dlgPass');
    $('passTip').textContent = tip || '';
    $('passInput').value = '';
    busy(null);
    dlg.returnValue = '';
    dlg.showModal();
    setTimeout(() => $('passInput').focus(), 30);
    dlg.addEventListener('close', function onClose() {
      dlg.removeEventListener('close', onClose);
      resolve(dlg.returnValue === 'ok' ? $('passInput').value : null);
    });
  });
}

/* ================================================================ 메뉴 */

function closeMenu() {
  $('moreMenu').hidden = true;
  $('btnMore').setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  const m = $('moreMenu');
  m.hidden = !m.hidden;
  $('btnMore').setAttribute('aria-expanded', String(!m.hidden));
  if (!m.hidden) { const b = m.querySelector('button:not([disabled]):not([hidden])'); if (b) b.focus(); }
}

function toggleFull() {
  closeMenu();
  if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
  const r = document.documentElement.requestFullscreen;
  if (!r) { toast('이 브라우저는 전체 화면을 지원하지 않습니다.'); return; }
  document.documentElement.requestFullscreen().catch(() => toast('이 화면에서는 전체 화면을 쓸 수 없습니다. 뷰어를 새 창으로 열어 보세요.'));
}

function openNewTab() {
  const d = state.active;
  if (!d || !d.bytes) return;
  closeMenu();
  const types = { pdf: 'application/pdf' };
  let type = types[d.kind] || d.type || '';
  if (d.kind === 'image' && !type) type = 'image/' + (extOf(d.name) === 'jpg' ? 'jpeg' : extOf(d.name));
  const url = URL.createObjectURL(new Blob([d.bytes], { type }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
}

function runAct(act) {
  switch (act) {
    case 'print': return doPrint();
    case 'mail': return openMail();
    case 'share': closeMenu(); return shareDoc();
    case 'download': closeMenu(); return downloadDoc();
    case 'newtab': return openNewTab();
    case 'full': return toggleFull();
    case 'info': return openInfo();
    case 'install': closeMenu(); return install();
    case 'standalone': closeMenu(); return window.open(location.href.split('#')[0].replace(/[?&]host=gas/, ''), '_blank', 'noopener');
    case 'formats': closeMenu(); return $('dlgFormats').showModal();
    case 'closeall':
      closeMenu();
      state.docs.slice().forEach((d) => { d.bytes = null; d.file = null; });
      state.docs = [];
      return showEmpty();
  }
}

/* ================================================================ 설치(PWA)·앱 연결 */

async function install() {
  const p = state.installPrompt;
  if (!p) { toast('브라우저 주소창 오른쪽의 설치 단추(⊕)로 설치할 수 있습니다.'); return; }
  p.prompt();
  try { await p.userChoice; } catch (_) {}
  state.installPrompt = null;
  $('installCard').hidden = true;
  $('miInstall').hidden = true;
}

function setupPwa() {
  const embedded = document.documentElement.classList.contains('embedded');
  $('miStandalone').hidden = !embedded;
  if (embedded || state.hostMode) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installPrompt = e;
    $('installCard').hidden = false;
    $('miInstall').hidden = false;
  });
  window.addEventListener('appinstalled', () => { $('installCard').hidden = true; $('miInstall').hidden = true; toast('설치했습니다. 파일을 오른쪽 클릭 → 연결 프로그램에서 "문서 뷰어"를 고를 수 있습니다.', 6000); });
  // 설치한 앱으로 파일을 열었을 때 (파일 연결)
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async (params) => {
      if (!params.files || !params.files.length) return;
      const files = [];
      for (const h of params.files) { try { files.push(await h.getFile()); } catch (_) {} }
      openFiles(files);
    });
  }
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !local) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ================================================================ 주소로 열기 (?url=) */

async function openFromUrl(u) {
  let url;
  try { url = new URL(u, location.href); } catch (_) { toast('주소가 올바르지 않습니다.'); return; }
  if (!/^https?:$/.test(url.protocol)) { toast('http·https 주소만 열 수 있습니다.'); return; }
  busy('파일을 받아오는 중…');
  try {
    const r = await fetch(url.href, { credentials: 'omit' });
    if (!r.ok) throw new Error('응답 ' + r.status);
    const blob = await r.blob();
    let name = '';
    const cd = r.headers.get('content-disposition') || '';
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
    if (m) name = decodeURIComponent(m[1] || m[2]);
    if (!name) name = decodeURIComponent(url.pathname.split('/').pop() || '') || '받은 파일';
    openFiles([new File([blob], name, { type: blob.type })]);
  } catch (e) {
    busy(null);
    toast('그 주소의 파일을 가져오지 못했습니다 (그 사이트가 다른 곳에서 읽는 것을 막았을 수 있습니다). 내려받아 직접 열어 주세요.', 6000);
  }
}

/* ================================================================ 구글 앱스 스크립트 연결 */

function setupBridge() {
  const params = new URLSearchParams(location.search);
  if (params.get('host') !== 'gas' || window.parent === window) return;
  state.hostMode = 'gas';
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const okOrigin = (o) => /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com$/.test(o) || o === 'https://script.google.com'
    || (local && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)); // 개발 중 시험용
  let parentOrigin = null;
  let seq = 0;
  const pending = new Map();
  const bridge = {
    ready: false,
    call(type, payload, transfer, timeout) {
      if (!parentOrigin) return Promise.resolve({ ok: false, error: '구글 앱과 연결되지 않았습니다.' });
      return new Promise((resolve) => {
        const id = ++seq;
        const timer = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: '시간이 너무 오래 걸립니다.' }); }, timeout || 90000);
        pending.set(id, (m) => { clearTimeout(timer); resolve(m); });
        window.parent.postMessage(Object.assign({ src: 'doc-viewer', type, id }, payload), parentOrigin, transfer || []);
      });
    },
  };
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || !okOrigin(e.origin)) return;
    const m = e.data;
    if (!m || m.src !== 'gas-shell') return;
    parentOrigin = e.origin;
    if (m.type === 'hello') {
      bridge.ready = true;
      state.user = m.user || null;
      const drive = (m.features || []).includes('drive');
      $('btnDrive').hidden = !drive;
      $('btnDrive2').hidden = !drive;
      document.querySelector('.privacy').textContent = '🔒 파일은 이 브라우저 안에서 열립니다. 드라이브에서 가져오거나 메일로 보낼 때만 내 구글 계정을 거칩니다.';
      return;
    }
    if (m.type === 'open-file' && m.bytes) { openFiles([new File([m.bytes], m.name || '파일', { type: m.mime || '' })]); return; }
    if (m.re && pending.has(m.re)) { const f = pending.get(m.re); pending.delete(m.re); f(m); }
  });
  state.bridge = bridge;
  window.parent.postMessage({ src: 'doc-viewer', type: 'hello' }, '*'); // 자료 없이 인사만
}

let driveNext = null;
async function driveSearch(append) {
  const q = $('driveQuery').value.trim();
  const list = $('driveList');
  const msg = $('driveMsg');
  msg.textContent = '드라이브를 읽는 중…';
  msg.className = 'msg';
  if (!append) list.innerHTML = '';
  const r = await state.bridge.call('drive:list', { query: q, pageToken: append ? driveNext : null }, null, 60000);
  if (!r.ok) { msg.textContent = '읽지 못했습니다: ' + (r.error || ''); msg.className = 'msg err'; return; }
  driveNext = r.next || null;
  $('driveMore').hidden = !driveNext;
  msg.textContent = r.files.length ? (q ? `"${q}" 찾은 결과` : '최근에 고친 파일') : '파일이 없습니다.';
  for (const f of r.files) {
    list.appendChild(el('li', { tabindex: '0', onclick: () => driveOpen(f), onkeydown: (e) => { if (e.key === 'Enter') driveOpen(f); } },
      f.icon ? el('img', { src: f.icon, alt: '' }) : svgUse('i-file'),
      el('span', { class: 'dn', text: f.name }),
      el('small', { text: [f.size ? formatSize(+f.size) : (f.native ? 'PDF 로 변환' : ''), f.modified ? new Date(f.modified).toLocaleDateString('ko-KR') : ''].filter(Boolean).join(' · ') })));
  }
}

async function driveOpen(f) {
  $('dlgDrive').close();
  busy(`드라이브에서 "${f.name}" 을(를) 가져오는 중…`);
  const r = await state.bridge.call('drive:get', { fileId: f.id }, null, 180000);
  busy(null);
  if (!r.ok) { toast('가져오지 못했습니다: ' + (r.error || ''), 5000); return; }
  openFiles([new File([r.bytes], r.name, { type: r.mime || '' })]);
}

/* ================================================================ 이벤트 연결 */

function bind() {
  const input = $('fileInput');
  const pick = () => { input.value = ''; input.click(); };
  $('btnOpen').onclick = pick;
  $('btnOpen2').onclick = pick;
  $('btnSideAdd').onclick = pick;
  input.onchange = () => openFiles(input.files);
  $('btnSide').onclick = () => toggleSide();
  $('brand').onclick = (e) => { if (state.active) { e.preventDefault(); showEmpty(); } };

  $('btnPrev').onclick = () => state.view && state.view.prev();
  $('btnNext').onclick = () => state.view && state.view.next();
  $('pageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const n = parseInt(e.target.value, 10); if (n && state.view) state.view.goTo(n - 1); e.target.blur(); }
  });
  $('pageInput').addEventListener('focus', (e) => e.target.select());
  $('btnZoomIn').onclick = () => state.view && state.view.zoomBy(1.2);
  $('btnZoomOut').onclick = () => state.view && state.view.zoomBy(1 / 1.2);
  $('zoomSel').onchange = (e) => {
    const v = e.target.value;
    if (!state.view || v === 'cur') return;
    state.view.setZoom(/^[\d.]+$/.test(v) ? parseFloat(v) : v);
  };
  $('btnRotate').onclick = () => state.view && state.view.rotate && state.view.rotate(90);
  $('btnFind').onclick = () => ($('findbar').hidden ? openFind() : closeFind());
  $('findInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runFind(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  });
  $('findNext').onclick = () => runFind(1);
  $('findPrev').onclick = () => runFind(-1);
  $('findClose').onclick = closeFind;
  $('btnPrint').onclick = doPrint;
  $('btnMail').onclick = openMail;
  $('btnDownload').onclick = () => downloadDoc();
  $('btnFull').onclick = toggleFull;
  $('btnInfo').onclick = openInfo;
  $('btnMore').onclick = (e) => { e.stopPropagation(); toggleMenu(); };
  $('moreMenu').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) runAct(b.dataset.act); });
  document.addEventListener('click', (e) => { if (!$('moreMenu').hidden && !e.target.closest('#moreMenu')) closeMenu(); });
  $('noteClose').onclick = () => showNote('');
  $('btnInstall').onclick = install;

  // 메일
  $('mailSend').onclick = sendMailDirect;
  $('mailShare').onclick = () => { $('dlgMail').close(); shareDoc(); };
  $('mailGmail').onclick = () => {
    const d = state.active;
    downloadDoc(d);
    const body = `첨부 파일: ${d.name}\n\n(방금 내려받은 파일을 이 메일 창에 끌어다 놓아 첨부해 주세요.)`;
    clickLink(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(d.name)}&body=${encodeURIComponent(body)}`);
    $('dlgMail').close();
    toast('파일을 내려받았습니다. Gmail 창에 끌어다 첨부해 주세요.', 6000);
  };
  $('mailApp').onclick = () => {
    const d = state.active;
    downloadDoc(d);
    const body = `첨부 파일: ${d.name}\n\n(방금 내려받은 파일을 첨부해 주세요.)`;
    const a = el('a', { href: `mailto:?subject=${encodeURIComponent(d.name)}&body=${encodeURIComponent(body)}` });
    document.body.appendChild(a); a.click(); a.remove();
    $('dlgMail').close();
    toast('파일을 내려받았습니다. 메일 프로그램에서 첨부해 주세요.', 6000);
  };

  // 드라이브
  const openDrive = () => { $('dlgDrive').showModal(); if (!$('driveList').children.length) driveSearch(false); };
  $('btnDrive').onclick = openDrive;
  $('btnDrive2').onclick = openDrive;
  $('driveSearch').onclick = () => driveSearch(false);
  $('driveMore').onclick = () => driveSearch(true);
  $('driveQuery').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); driveSearch(false); } });

  // 끌어 놓기
  let depth = 0;
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; $('dropOverlay').hidden = false; });
  window.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) $('dropOverlay').hidden = true; });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    $('dropOverlay').hidden = true;
    openFiles(e.dataTransfer.files);
  });

  // 붙여 넣기 (그림·파일)
  document.addEventListener('paste', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
    const files = [...((e.clipboardData && e.clipboardData.files) || [])];
    if (files.length) { e.preventDefault(); openFiles(files); }
  });

  // Ctrl+휠 확대
  $('stage').addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey) || !state.view) return;
    e.preventDefault();
    state.view.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  // 단축키
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    const k = e.key;
    if (mod && (k === 'o' || k === 'O')) { e.preventDefault(); pick(); return; }
    if (mod && (k === 'p' || k === 'P') && state.res) { e.preventDefault(); doPrint(); return; }
    if (mod && (k === 'f' || k === 'F') && state.view) { if (openFind()) e.preventDefault(); return; }
    if (mod && (k === '=' || k === '+') && state.view) { e.preventDefault(); state.view.zoomBy(1.2); return; }
    if (mod && k === '-' && state.view) { e.preventDefault(); state.view.zoomBy(1 / 1.2); return; }
    if (mod && k === '0' && state.view) { e.preventDefault(); state.view.setZoom(state.res && state.res.paged ? 'width' : 1); return; }
    if (k === 'Escape') { closeMenu(); if (!$('findbar').hidden && !typing) closeFind(); return; }
    if (typing || mod || e.altKey) return;
    const v = state.view;
    if (!v || !v.pageCount) return;
    const paged = !!(state.res && state.res.paged);
    if (k === 'PageDown' || (paged && (k === 'ArrowRight'))) { e.preventDefault(); v.next(); }
    else if (k === 'PageUp' || (paged && (k === 'ArrowLeft'))) { e.preventDefault(); v.prev(); }
    else if (k === 'Home' && paged) { e.preventDefault(); v.goTo(0); }
    else if (k === 'End' && paged) { e.preventDefault(); v.goTo(v.pageCount - 1); }
  });

  // 대화상자 바깥을 누르면 닫기
  document.querySelectorAll('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('cancel'); });
  });
}

/* ================================================================ 시작 */

function start() {
  renderFormats();
  bind();
  setupBridge();
  setupPwa();
  updateTools();
  // ?url=주소 (여러 번 줄 수 있음) 또는 #url=주소 로 바로 열기
  const params = new URLSearchParams(location.search);
  const urls = params.getAll('url');
  if (!urls.length && location.hash.startsWith('#url=')) urls.push(decodeURIComponent(location.hash.slice(5)));
  (async () => { for (const u of urls) await openFromUrl(u); })();
  window.DocViewer = { openFiles, state };
}

start();
