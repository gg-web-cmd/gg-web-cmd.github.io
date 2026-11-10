/* 파워포인트 .pptx
 *  1) pptx-preview(npm, 무료 사용 허용)로 슬라이드 모양 그대로 그린다 — jsDelivr 에서 받는다.
 *  2) 받지 못하거나 실패하면 슬라이드마다 글과 그림만 뽑아 보여 준다(자체 구현). */
import { FlowView } from '../flow.js';
import { libs, loadScript, el, decodeUtf8 } from '../util.js';

const PPTX_PREVIEW = 'https://cdn.jsdelivr.net/npm/pptx-preview@1.0.7/dist/pptx-preview.umd.js';
const EMU_PX = 96 / 914400;

async function slideSize(zip) {
  try {
    const xml = await zip.file('ppt/presentation.xml').async('string');
    const m = /<p:sldSz[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(xml);
    if (m) return { w: +m[1] * EMU_PX, h: +m[2] * EMU_PX };
  } catch (_) {}
  return { w: 960, h: 540 };
}

/** 슬라이드 순서대로 파일 이름 */
async function slideOrder(zip) {
  const pres = await zip.file('ppt/presentation.xml').async('string');
  const rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  const map = {};
  rels.replace(/<Relationship\b[^>]*>/g, (r) => {
    const id = /Id="([^"]+)"/.exec(r), t = /Target="([^"]+)"/.exec(r);
    if (id && t) map[id[1]] = t[1];
    return r;
  });
  const out = [];
  pres.replace(/<p:sldId\b[^>]*r:id="([^"]+)"/g, (m, rid) => {
    const t = map[rid];
    if (t) out.push('ppt/' + t.replace(/^\/?ppt\//, '').replace(/^\.\//, ''));
    return m;
  });
  return out;
}

async function renderFallback(doc, view, ctx) {
  const JSZip = await libs.jszip();
  const zip = await JSZip.loadAsync(doc.bytes);
  const files = await slideOrder(zip);
  const parser = new DOMParser();
  let n = 0;
  for (const f of files) {
    n++;
    const card = el('section', { class: 'slide-card' }, el('h3', { text: `슬라이드 ${n}` }));
    const xml = await zip.file(f)?.async('string');
    if (!xml) continue;
    const d = parser.parseFromString(xml, 'application/xml');
    const paras = [...d.getElementsByTagNameNS('*', 'p')].filter((p) => p.namespaceURI && p.namespaceURI.includes('drawingml'));
    for (const p of paras) {
      const t = [...p.getElementsByTagNameNS('*', 't')].map((x) => x.textContent).join('');
      if (t.trim()) card.appendChild(el('p', { text: t }));
    }
    // 그림
    const relPath = f.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const relXml = await zip.file(relPath)?.async('string');
    if (relXml) {
      const imgs = [...relXml.matchAll(/Target="\.\.\/media\/([^"]+\.(png|jpe?g|gif|bmp|webp|svg))"/gi)];
      for (const m of imgs.slice(0, 6)) {
        const file = zip.file('ppt/media/' + m[1]);
        if (!file) continue;
        const blob = await file.async('blob');
        const type = /svg$/i.test(m[1]) ? 'image/svg+xml' : '';
        card.appendChild(el('img', { src: URL.createObjectURL(type ? new Blob([blob], { type }) : blob), alt: '', loading: 'lazy' }));
      }
    }
    // 발표자 메모
    const noteRel = relXml && /Target="\.\.\/notesSlides\/([^"]+)"/.exec(relXml);
    if (noteRel) {
      const nx = await zip.file('ppt/notesSlides/' + noteRel[1])?.async('string');
      if (nx) {
        const nd = parser.parseFromString(nx, 'application/xml');
        const txt = [...nd.getElementsByTagNameNS('*', 'p')].map((p) => [...p.getElementsByTagNameNS('*', 't')].map((x) => x.textContent).join('')).filter((s) => s.trim() && !/^\d+$/.test(s.trim())).join('\n');
        if (txt) card.appendChild(el('div', { class: 'slide-notes' }, el('b', { text: '발표자 메모' }), el('p', { text: txt })));
      }
    }
    view.content.appendChild(card);
  }
  return n;
}

export async function render(doc, container, ctx) {
  ctx.progress('슬라이드를 그리는 중…');
  const JSZip = await libs.jszip();
  const zip = await JSZip.loadAsync(doc.bytes);
  const size = await slideSize(zip);
  const view = new FlowView(container, ctx.flowOpts({ className: 'pptx-flow', pageSelector: '.pptx-preview-slide-wrapper, .slide-card', zoom: 'auto' }));

  let note = null;
  let usedLib = false;
  try {
    ctx.progress('슬라이드 그리기 도구를 받는 중… (인터넷 필요)');
    const lib = await Promise.race([
      loadScript(PPTX_PREVIEW, 'pptxPreview'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('시간 초과')), 20000)),
    ]);
    ctx.progress('슬라이드를 그리는 중…');
    const host = el('div', { class: 'pptx-host' });
    view.content.appendChild(host);
    const W = 960;
    const previewer = lib.init(host, { width: W, height: Math.round(W * size.h / size.w), mode: 'list' });
    await previewer.preview(doc.bytes.slice().buffer);
    usedLib = true;
    view.opts.onDestroy = () => { try { previewer.destroy(); } catch (_) {} };
  } catch (e) {
    console.warn('pptx-preview 실패, 글·그림만 보여 줍니다', e);
    view.content.innerHTML = '';
    await renderFallback(doc, view, ctx);
    note = '슬라이드 그리기 도구를 쓸 수 없어 슬라이드마다 글과 그림만 보여 줍니다.';
  }
  view.content.querySelectorAll('a[href]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  view.ready();
  let count = view.pageCount;
  if (!count) { try { count = (await slideOrder(zip)).length; } catch (_) {} }
  return {
    flow: view,
    note,
    printCss: '@page { size: landscape; margin: 6mm; }',
    info: [['슬라이드', `${count}장`], ['슬라이드 크기', `${Math.round(size.w / 96 * 25.4)} × ${Math.round(size.h / 96 * 25.4)} mm`], ['그리기', usedLib ? 'pptx-preview' : '글·그림만']],
  };
}

export { renderFallback };
