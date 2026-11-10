/* PDF — pdf.js 5 (tools/common/pdfjs, 교실 도구함이 함께 쓰는 것).
 * 쪽마다 캔버스 + 글자 층(선택·복사·찾기) + 링크 층. */
import { PagedView } from '../paged.js';
import { at, el } from '../util.js';

const PT = 96 / 72; // PDF 포인트 → CSS px

let libP = null;
export function pdfjs() {
  if (!libP) {
    libP = import(at('../common/pdfjs/pdf.min.mjs')).then((m) => {
      m.GlobalWorkerOptions.workerSrc = at('../common/pdfjs/pdf.worker.min.mjs');
      return m;
    }).catch((e) => { libP = null; throw e; });
  }
  return libP;
}

function fmtDate(s) {
  const m = /D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(s || '');
  if (!m) return '';
  return `${m[1]}-${m[2] || '01'}-${m[3] || '01'}` + (m[4] ? ` ${m[4]}:${m[5] || '00'}` : '');
}

export async function render(doc, container, ctx) {
  ctx.progress('PDF 를 여는 중…');
  const lib = await pdfjs();
  const task = lib.getDocument({
    data: doc.bytes.slice(), // pdf.js 가 버퍼를 일꾼에게 넘겨 버리므로 복사본을 준다
    cMapUrl: at('../common/pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: at('../common/pdfjs/standard_fonts/'),
    wasmUrl: at('../common/pdfjs/wasm/'),
    iccUrl: at('../common/pdfjs/iccs/'),
    isEvalSupported: false,
    enableXfa: true,
  });
  task.onPassword = (update, reason) => {
    ctx.askPassword(reason === lib.PasswordResponses.INCORRECT_PASSWORD ? '암호가 맞지 않습니다. 다시 넣어 주세요.' : '이 PDF 는 암호로 잠겨 있습니다.')
      .then((pw) => { if (pw == null) task.destroy(); else update(pw); });
  };
  const pdf = await task.promise;
  const n = pdf.numPages;

  // 쪽 크기: 앞쪽 몇 장은 바로, 나머지는 첫 쪽 크기로 두었다가 뒤에서 채운다.
  const sizes = new Array(n);
  const first = await pdf.getPage(1);
  const v1 = first.getViewport({ scale: 1 });
  const base = { w: v1.width * PT, h: v1.height * PT };
  sizes[0] = base;

  let view = null;
  const pageCache = new Map();
  const getPage = (i) => {
    if (!pageCache.has(i)) pageCache.set(i, pdf.getPage(i + 1));
    return pageCache.get(i);
  };
  pageCache.set(0, Promise.resolve(first));

  const tasks = new Map();
  const src = {
    pageCount: n,
    rotatable: true,
    pageSize: (i) => sizes[i] || base,
    async render(i, box, scale, rot) {
      const page = await getPage(i);
      const vp = page.getViewport({ scale: scale * PT, rotation: (page.rotate + rot) % 360 });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      // 캔버스가 너무 크면 브라우저가 그리기를 포기한다. 1600만 화소에서 자른다.
      const maxPx = 16e6;
      let k = dpr;
      if (vp.width * vp.height * k * k > maxPx) k = Math.sqrt(maxPx / (vp.width * vp.height));
      const cv = el('canvas', { class: 'pg-canvas' });
      cv.width = Math.max(1, Math.floor(vp.width * k));
      cv.height = Math.max(1, Math.floor(vp.height * k));
      cv.style.width = Math.floor(vp.width) + 'px';
      cv.style.height = Math.floor(vp.height) + 'px';
      const c2d = cv.getContext('2d', { alpha: false });
      c2d.fillStyle = '#fff';
      c2d.fillRect(0, 0, cv.width, cv.height);
      const prev = tasks.get(i);
      if (prev) { try { prev.cancel(); } catch (_) {} }
      const t = page.render({ canvasContext: c2d, viewport: vp, transform: k !== 1 ? [k, 0, 0, k, 0, 0] : null });
      tasks.set(i, t);
      try { await t.promise; } finally { tasks.delete(i); }

      // 그린 뒤에 바꿔 끼운다(깜빡임 없이)
      [...box.querySelectorAll('.pg-canvas, .textLayer, .linkLayer')].forEach((x) => x.remove());
      box.appendChild(cv);

      // 실제 크기가 첫 쪽과 다르면 자리를 고친다
      const real = page.getViewport({ scale: 1 });
      const sz = { w: real.width * PT, h: real.height * PT };
      if (!sizes[i] || Math.abs(sizes[i].w - sz.w) > 1 || Math.abs(sizes[i].h - sz.h) > 1) {
        sizes[i] = sz;
        if (view) requestAnimationFrame(() => view.applyZoom(true));
      }

      // 글자 층
      const tl = el('div', { class: 'textLayer' });
      box.style.setProperty('--scale-factor', vp.scale);
      box.style.setProperty('--total-scale-factor', vp.scale);
      box.appendChild(tl);
      try {
        const layer = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport: vp });
        await layer.render();
      } catch (_) { /* 글자 층이 없어도 보기는 된다 */ }

      // 링크 층
      try {
        const annots = await page.getAnnotations({ intent: 'display' });
        const links = annots.filter((a) => a.subtype === 'Link' && (a.url || a.dest));
        if (links.length) {
          const ll = el('div', { class: 'linkLayer' });
          for (const a of links) {
            const r = vp.convertToViewportRectangle(a.rect);
            const x = Math.min(r[0], r[2]), y = Math.min(r[1], r[3]);
            const w = Math.abs(r[2] - r[0]), h = Math.abs(r[3] - r[1]);
            const link = el('a', { style: { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' } });
            if (a.url && /^(https?:|mailto:)/i.test(a.url)) {
              link.href = a.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = a.url;
            } else if (a.dest) {
              link.href = '#'; link.title = '문서 안 이동';
              link.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                  const dest = typeof a.dest === 'string' ? await pdf.getDestination(a.dest) : a.dest;
                  if (dest && dest[0]) view.goTo(await pdf.getPageIndex(dest[0]));
                } catch (_) {}
              });
            } else continue;
            ll.appendChild(link);
          }
          box.appendChild(ll);
        }
      } catch (_) {}
    },
    release(i, box) {
      box.querySelectorAll('canvas').forEach((c) => { c.width = 0; c.height = 0; });
    },
    async pageText(i) {
      const page = await getPage(i);
      const tc = await page.getTextContent();
      return tc.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : '')).join('');
    },
    async printPage(i, rot) {
      const page = await getPage(i);
      const vp = page.getViewport({ scale: 2 * PT, rotation: (page.rotate + rot) % 360 }); // 약 192dpi
      const cv = document.createElement('canvas');
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      const c2d = cv.getContext('2d', { alpha: false });
      c2d.fillStyle = '#fff'; c2d.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: c2d, viewport: vp, intent: 'print' }).promise;
      const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.92));
      cv.width = 0; cv.height = 0;
      return el('img', { src: URL.createObjectURL(blob), alt: '' });
    },
    destroy() { try { pdf.destroy(); } catch (_) {} },
  };

  view = new PagedView(container, src, ctx.pagedOpts({ zoom: n === 1 && v1.width > v1.height ? 'page' : 'width' }));

  // 나머지 쪽 크기를 뒤에서 조용히 채운다 (자리 표시가 정확해진다)
  (async () => {
    let dirty = false;
    for (let i = 1; i < n && !view.destroyed; i++) {
      const p = await getPage(i);
      const v = p.getViewport({ scale: 1 });
      const sz = { w: v.width * PT, h: v.height * PT };
      if (Math.abs(sz.w - base.w) > 1 || Math.abs(sz.h - base.h) > 1) dirty = true;
      sizes[i] = sz;
      if (i % 50 === 0 && dirty) { view.applyZoom(true); dirty = false; }
      if (i > 60) pageCache.delete(i); // 쪽 객체를 다 들고 있지 않는다
    }
    if (dirty && !view.destroyed) view.applyZoom(true);
  })().catch(() => {});

  const info = [['쪽 수', n + '쪽'], ['쪽 크기', `${Math.round(v1.width / 72 * 25.4)} × ${Math.round(v1.height / 72 * 25.4)} mm`]];
  try {
    const meta = await pdf.getMetadata();
    const I = meta.info || {};
    if (I.Title) info.push(['제목', I.Title]);
    if (I.Author) info.push(['만든 이', I.Author]);
    if (I.Creator || I.Producer) info.push(['만든 프로그램', [I.Creator, I.Producer].filter(Boolean).join(' / ')]);
    if (I.CreationDate) info.push(['만든 날', fmtDate(I.CreationDate)]);
    if (I.PDFFormatVersion) info.push(['PDF 판', I.PDFFormatVersion]);
  } catch (_) {}
  return { paged: view, info };
}
