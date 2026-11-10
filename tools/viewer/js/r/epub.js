/* 전자책 EPUB — 차례(spine) 순서대로 장을 이어 붙여 읽기 좋은 모양으로 보여 준다. */
import { FlowView } from '../flow.js';
import { libs, el, hardenLinks } from '../util.js';

function resolvePath(base, rel) {
  if (/^[a-z]+:/i.test(rel)) return rel;
  const parts = base.split('/'); parts.pop();
  for (const seg of rel.split('/')) {
    if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

export async function render(doc, container, ctx) {
  ctx.progress('전자책을 펴는 중…');
  const [JSZip, P] = await Promise.all([libs.jszip(), libs.purify()]);
  const zip = await JSZip.loadAsync(doc.bytes);
  const parser = new DOMParser();
  const container_ = await zip.file('META-INF/container.xml')?.async('string');
  const opfPath = container_ && (/full-path="([^"]+)"/.exec(container_) || [])[1];
  if (!opfPath) throw new Error('EPUB 의 목차 파일을 찾지 못했습니다.');
  const opf = parser.parseFromString(await zip.file(opfPath).async('string'), 'application/xml');
  const manifest = {};
  for (const it of opf.getElementsByTagNameNS('*', 'item')) manifest[it.getAttribute('id')] = { href: resolvePath(opfPath, decodeURIComponent(it.getAttribute('href'))), type: it.getAttribute('media-type') };
  const spine = [...opf.getElementsByTagNameNS('*', 'itemref')].map((r) => manifest[r.getAttribute('idref')]).filter(Boolean);
  const title = (opf.getElementsByTagNameNS('*', 'title')[0] || {}).textContent || doc.name;
  const author = (opf.getElementsByTagNameNS('*', 'creator')[0] || {}).textContent || '';

  const urls = [];
  const blobUrl = async (path) => {
    const f = zip.file(path);
    if (!f) return null;
    const type = Object.values(manifest).find((m) => m.href === path)?.type || '';
    const u = URL.createObjectURL(new Blob([await f.async('uint8array')], { type }));
    urls.push(u);
    return u;
  };

  const view = new FlowView(container, ctx.flowOpts({ className: 'epub-flow', pageSelector: '.epub-ch', zoom: 1 }));
  const book = el('article', { class: 'epub-book md-body' }, el('h1', { class: 'epub-title', text: title }), author ? el('p', { class: 'epub-author', text: author }) : null);
  view.content.appendChild(book);
  let i = 0;
  for (const item of spine) {
    if (!/x?html/.test(item.type || 'html')) continue;
    ctx.progress(`전자책을 펴는 중… ${++i}/${spine.length}`);
    const f = zip.file(item.href);
    if (!f) continue;
    const d = parser.parseFromString(await f.async('string'), 'application/xhtml+xml');
    const body = d.body || d.getElementsByTagName('body')[0];
    if (!body) continue;
    const clean = P.sanitize(body.innerHTML, { FORBID_TAGS: ['style', 'script', 'form', 'iframe', 'link'], FORBID_ATTR: ['style'] });
    const ch = el('section', { class: 'epub-ch', html: clean });
    for (const img of ch.querySelectorAll('img[src], image')) {
      const attr = img.tagName.toLowerCase() === 'image' ? (img.getAttribute('href') ? 'href' : 'xlink:href') : 'src';
      const src = img.getAttribute(attr);
      if (!src || /^(data|https?):/i.test(src)) continue;
      const u = await blobUrl(resolvePath(item.href, decodeURIComponent(src)));
      if (u) img.setAttribute(attr, u); else img.remove();
    }
    ch.querySelectorAll('a[href]').forEach((a) => { if (!/^https?:/i.test(a.getAttribute('href'))) a.removeAttribute('href'); });
    book.appendChild(ch);
  }
  hardenLinks(book);
  view.ready();
  return { flow: view, info: [['제목', title], author ? ['지은이', author] : null, ['장', view.pageCount + '개']].filter(Boolean), onDestroy() { urls.forEach((u) => URL.revokeObjectURL(u)); } };
}
