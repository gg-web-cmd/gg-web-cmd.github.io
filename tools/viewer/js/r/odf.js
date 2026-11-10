/* ODF 문서(.odt — 공문 본문으로 자주 옴)·프레젠테이션(.odp) 을 HTML 로 옮겨 보여 준다.
 * 스프레드시트(.ods)는 sheet.js 가 맡는다.
 * 문단·제목·글자 모양·정렬·목록·표(병합)·그림·링크·각주를 살린다. */
import { FlowView } from '../flow.js';
import { libs, el, hardenLinks } from '../util.js';

const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  draw: 'urn:oasis:names:tc:opendocument:xmlns:drawing:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  xlink: 'http://www.w3.org/1999/xlink',
  svg: 'urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0',
  presentation: 'urn:oasis:names:tc:opendocument:xmlns:presentation:1.0',
};
const A = (n, ns, name) => n.getAttributeNS(NS[ns], name);

/** 스타일 이름 → CSS (부모 스타일을 이어받는다) */
function buildStyles(docs) {
  const raw = new Map();
  for (const d of docs) {
    if (!d) continue;
    for (const s of d.getElementsByTagNameNS(NS.style, 'style')) {
      const name = A(s, 'style', 'name');
      if (!name) continue;
      const css = {};
      const parent = A(s, 'style', 'parent-style-name');
      for (const p of s.children) {
        const local = p.localName;
        if (!/-properties$/.test(local)) continue;
        const g = (ns, a) => p.getAttributeNS(NS[ns], a);
        if (local === 'text-properties') {
          if (g('fo', 'font-weight') === 'bold') css['font-weight'] = 'bold';
          if (g('fo', 'font-style') === 'italic') css['font-style'] = 'italic';
          const fs = g('fo', 'font-size'); if (fs && !/%$/.test(fs)) css['font-size'] = fs;
          const col = g('fo', 'color'); if (col) css.color = col;
          const bg = g('fo', 'background-color'); if (bg && bg !== 'transparent') css['background-color'] = bg;
          const fn = g('style', 'font-name') || g('style', 'font-name-asian') || g('fo', 'font-family');
          if (fn) css['font-family'] = `"${fn.replace(/"/g, '')}", "Malgun Gothic", sans-serif`;
          const ul = g('style', 'text-underline-style'); if (ul && ul !== 'none') css['text-decoration'] = 'underline';
          const lt = g('style', 'text-line-through-style'); if (lt && lt !== 'none') css['text-decoration'] = (css['text-decoration'] ? css['text-decoration'] + ' ' : '') + 'line-through';
          const pos = g('style', 'text-position'); if (pos && /^super/.test(pos)) css['vertical-align'] = 'super'; else if (pos && /^sub/.test(pos)) css['vertical-align'] = 'sub';
          const ls = g('fo', 'letter-spacing'); if (ls && ls !== 'normal') css['letter-spacing'] = ls;
        } else if (local === 'paragraph-properties') {
          const ta = g('fo', 'text-align'); if (ta) css['text-align'] = ta === 'start' ? 'left' : ta === 'end' ? 'right' : ta;
          for (const k of ['margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'text-indent', 'line-height', 'padding']) {
            const v = g('fo', k); if (v && !/%$/.test(v) || (k === 'line-height' && v)) css[k] = v;
          }
          const bg = g('fo', 'background-color'); if (bg && bg !== 'transparent') css['background-color'] = bg;
          const br = g('fo', 'break-before'); if (br === 'page') css['break-before'] = 'page';
          for (const k of ['border', 'border-top', 'border-bottom', 'border-left', 'border-right']) { const v = g('fo', k); if (v && v !== 'none') css[k] = v; }
        } else if (local === 'table-cell-properties') {
          for (const k of ['border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right']) {
            const v = g('fo', k); if (v) css[k] = v;
          }
          const bg = g('fo', 'background-color'); if (bg && bg !== 'transparent') css['background-color'] = bg;
          const va = g('style', 'vertical-align'); if (va) css['vertical-align'] = va === 'automatic' ? 'top' : va;
        } else if (local === 'table-column-properties') {
          const w = g('style', 'column-width'); if (w) css.width = w;
        } else if (local === 'table-properties') {
          const w = g('style', 'width'); if (w) css.width = w;
          const al = g('table', 'align'); if (al === 'center') { css['margin-left'] = 'auto'; css['margin-right'] = 'auto'; }
        } else if (local === 'table-row-properties') {
          const h = g('style', 'min-row-height') || g('style', 'row-height'); if (h) css.height = h;
        }
      }
      raw.set(name, { css, parent });
    }
  }
  const cache = new Map();
  function resolve(name, depth) {
    if (!name || depth > 10) return {};
    if (cache.has(name)) return cache.get(name);
    const r = raw.get(name);
    if (!r) return {};
    const out = Object.assign({}, resolve(r.parent, (depth || 0) + 1), r.css);
    cache.set(name, out);
    return out;
  }
  return (name) => {
    const c = resolve(name, 0);
    return Object.keys(c).map((k) => `${k}:${c[k]}`).join(';');
  };
}

class Converter {
  constructor(zip, styleOf) {
    this.zip = zip;
    this.styleOf = styleOf;
    this.notes = [];
    this.urls = [];
  }

  async image(href) {
    if (!href || /^https?:/i.test(href)) return null;
    const f = this.zip.file(href.replace(/^\.\//, ''));
    if (!f) return null;
    let blob = await f.async('blob');
    if (/\.svg$/i.test(href)) blob = new Blob([blob], { type: 'image/svg+xml' });
    const u = URL.createObjectURL(blob);
    this.urls.push(u);
    return u;
  }

  async inline(node, parent) {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { parent.appendChild(document.createTextNode(c.nodeValue)); continue; }
      if (c.nodeType !== 1) continue;
      const ln = c.localName, ns = c.namespaceURI;
      if (ns === NS.text) {
        if (ln === 's') { parent.appendChild(document.createTextNode(' '.repeat(+(A(c, 'text', 'c') || 1)))); continue; }
        if (ln === 'tab') { parent.appendChild(el('span', { class: 'odf-tab' }, '\t')); continue; }
        if (ln === 'line-break') { parent.appendChild(el('br')); continue; }
        if (ln === 'soft-page-break' || ln === 'bookmark' || ln === 'bookmark-start' || ln === 'bookmark-end' || ln === 'reference-mark') continue;
        if (ln === 'span') {
          const s = el('span', { style: this.styleOf(A(c, 'text', 'style-name')) || null });
          await this.inline(c, s); parent.appendChild(s); continue;
        }
        if (ln === 'a') {
          const a = el('a', { href: A(c, 'xlink', 'href') || '#' });
          await this.inline(c, a); parent.appendChild(a); continue;
        }
        if (ln === 'note') {
          const cit = c.getElementsByTagNameNS(NS.text, 'note-citation')[0];
          const body = c.getElementsByTagNameNS(NS.text, 'note-body')[0];
          const num = cit ? cit.textContent : String(this.notes.length + 1);
          parent.appendChild(el('sup', { class: 'odf-noteref', text: num }));
          if (body) { const d = el('div'); await this.blocks(body, d); this.notes.push({ num, d }); }
          continue;
        }
      }
      if (ns === NS.draw && (ln === 'frame' || ln === 'a' || ln === 'g')) { await this.frame(c, parent, true); continue; }
      // 그 밖(필드 등)은 글자만
      await this.inline(c, parent);
    }
  }

  async frame(f, parent, inlineMode) {
    const w = A(f, 'svg', 'width'), h = A(f, 'svg', 'height');
    for (const c of f.children) {
      if (c.localName === 'image' && c.namespaceURI === NS.draw) {
        const u = await this.image(A(c, 'xlink', 'href'));
        if (u) parent.appendChild(el('img', { class: 'odf-img', src: u, alt: '', style: `${w ? 'width:' + w + ';' : ''}${h ? 'height:' + h + ';' : ''}max-width:100%;object-fit:contain` }));
        return;
      }
      if (c.localName === 'text-box') {
        const d = el('div', { class: 'odf-textbox', style: w ? `width:${w};max-width:100%` : null });
        await this.blocks(c, d);
        parent.appendChild(d);
        return;
      }
      if (c.localName === 'frame' || c.localName === 'g') await this.frame(c, parent, inlineMode);
    }
  }

  async blocks(node, parent) {
    for (const c of node.children) {
      const ln = c.localName, ns = c.namespaceURI;
      if (ns === NS.text && (ln === 'p' || ln === 'h')) {
        const lvl = ln === 'h' ? Math.min(6, +(A(c, 'text', 'outline-level') || 1)) : 0;
        const p = el(lvl ? 'h' + lvl : 'p', { class: 'odf-p', style: this.styleOf(A(c, 'text', 'style-name')) || null });
        await this.inline(c, p);
        if (!p.childNodes.length) p.appendChild(el('br'));
        parent.appendChild(p);
      } else if (ns === NS.text && ln === 'list') {
        const ul = el('ul', { class: 'odf-list' });
        for (const it of c.children) {
          if (it.localName !== 'list-item' && it.localName !== 'list-header') continue;
          const li = el('li');
          await this.blocks(it, li);
          ul.appendChild(li);
        }
        parent.appendChild(ul);
      } else if (ns === NS.table && ln === 'table') {
        parent.appendChild(await this.table(c));
      } else if (ns === NS.text && (ln === 'section' || ln === 'index-body' || ln === 'table-of-content' || ln === 'illustration-index' || ln === 'alphabetical-index')) {
        const body = ln === 'table-of-content' ? (c.getElementsByTagNameNS(NS.text, 'index-body')[0] || c) : c;
        await this.blocks(body, parent);
      } else if (ns === NS.draw && (ln === 'frame' || ln === 'g' || ln === 'custom-shape')) {
        await this.frame(c, parent, false);
      } else if (ns === NS.table && (ln === 'table-header-rows' || ln === 'table-rows')) {
        await this.blocks(c, parent);
      }
    }
  }

  async table(t) {
    const table = el('table', { class: 'odf-table', style: this.styleOf(A(t, 'table', 'style-name')) || null });
    const cg = el('colgroup');
    for (const col of t.getElementsByTagNameNS(NS.table, 'table-column')) {
      if (col.parentNode !== t && col.parentNode.localName !== 'table-columns' && col.parentNode.localName !== 'table-header-columns') continue;
      const rep = Math.min(64, +(A(col, 'table', 'number-columns-repeated') || 1));
      const st = this.styleOf(A(col, 'table', 'style-name'));
      for (let i = 0; i < rep; i++) cg.appendChild(el('col', { style: st || null }));
    }
    if (cg.children.length) table.appendChild(cg);
    const tb = el('tbody');
    const rows = [];
    const collect = (n) => { for (const c of n.children) { if (c.localName === 'table-row') rows.push(c); else if (/^table-(header-)?rows$/.test(c.localName) || c.localName === 'table-row-group') collect(c); } };
    collect(t);
    for (const r of rows) {
      const rep = Math.min(50, +(A(r, 'table', 'number-rows-repeated') || 1));
      for (let k = 0; k < rep; k++) {
        const tr = el('tr', { style: this.styleOf(A(r, 'table', 'style-name')) || null });
        for (const cell of r.children) {
          if (cell.localName === 'covered-table-cell') continue;
          if (cell.localName !== 'table-cell') continue;
          const crep = Math.min(64, +(A(cell, 'table', 'number-columns-repeated') || 1));
          for (let j = 0; j < crep; j++) {
            const td = el('td', { style: this.styleOf(A(cell, 'table', 'style-name')) || null });
            const cs = A(cell, 'table', 'number-columns-spanned'), rs = A(cell, 'table', 'number-rows-spanned');
            if (cs && cs !== '1') td.colSpan = +cs;
            if (rs && rs !== '1') td.rowSpan = +rs;
            await this.blocks(cell, td);
            tr.appendChild(td);
          }
        }
        tb.appendChild(tr);
      }
    }
    table.appendChild(tb);
    return table;
  }
}

function pageLayout(stylesDoc) {
  if (!stylesDoc) return null;
  const pl = stylesDoc.getElementsByTagNameNS(NS.style, 'page-layout-properties')[0];
  if (!pl) return null;
  const g = (k) => pl.getAttributeNS(NS.fo, k);
  return { w: g('page-width'), h: g('page-height'), ml: g('margin-left'), mr: g('margin-right'), mt: g('margin-top'), mb: g('margin-bottom') };
}

export async function render(doc, container, ctx) {
  ctx.progress('ODF 문서를 옮기는 중…');
  const JSZip = await libs.jszip();
  const zip = await JSZip.loadAsync(doc.bytes);
  const parser = new DOMParser();
  const read = async (p) => { const f = zip.file(p); return f ? parser.parseFromString(await f.async('string'), 'application/xml') : null; };
  const content = await read('content.xml');
  if (!content) throw new Error('content.xml 이 없어 ODF 문서로 읽지 못했습니다.');
  const styles = await read('styles.xml');
  const styleOf = buildStyles([styles, content]);
  const conv = new Converter(zip, styleOf);

  const body = content.getElementsByTagNameNS(NS.office, 'body')[0];
  const textRoot = body && body.getElementsByTagNameNS(NS.office, 'text')[0];
  const presRoot = body && body.getElementsByTagNameNS(NS.office, 'presentation')[0];
  const isPres = !!presRoot && !textRoot;
  const view = new FlowView(container, ctx.flowOpts({ className: 'odf-flow', pageSelector: isPres ? '.odp-slide' : '.odf-page', zoom: 'auto' }));
  const pl = pageLayout(styles) || {};

  if (isPres) {
    let n = 0;
    for (const page of presRoot.getElementsByTagNameNS(NS.draw, 'page')) {
      n++;
      const slide = el('section', { class: 'odp-slide', style: `width:${pl.w || '28cm'};height:${pl.h || '15.75cm'}` });
      for (const f of page.children) {
        if (f.namespaceURI === NS.presentation && f.localName === 'notes') continue;
        const x = A(f, 'svg', 'x'), y = A(f, 'svg', 'y'), w = A(f, 'svg', 'width'), h = A(f, 'svg', 'height');
        const box = el('div', { class: 'odp-box', style: `left:${x || 0};top:${y || 0};${w ? 'width:' + w + ';' : ''}${h ? 'height:' + h + ';' : ''}` });
        if (f.localName === 'frame') await conv.frame(f, box, false);
        else await conv.blocks(f, box);
        // 도형 안 글(text:p 가 바로 들어 있는 custom-shape 등)
        if (!box.childNodes.length && f.getElementsByTagNameNS(NS.text, 'p').length) await conv.blocks(f, box);
        if (box.childNodes.length) slide.appendChild(box);
      }
      view.content.appendChild(slide);
    }
  } else {
    const page = el('div', { class: 'odf-page', style: `width:${pl.w || '21cm'};min-height:${pl.h || '29.7cm'};padding:${pl.mt || '2cm'} ${pl.mr || '2cm'} ${pl.mb || '2cm'} ${pl.ml || '2cm'}` });
    await conv.blocks(textRoot || body, page);
    if (conv.notes.length) {
      const fn = el('div', { class: 'odf-notes' }, el('hr'));
      for (const nt of conv.notes) fn.appendChild(el('div', { class: 'odf-note' }, el('sup', { text: nt.num }), nt.d));
      page.appendChild(fn);
    }
    view.content.appendChild(page);
  }
  hardenLinks(view.content);
  view.ready();
  return {
    flow: view,
    info: [['형식', isPres ? 'ODF 프레젠테이션' : 'ODF 문서'], isPres ? ['슬라이드', view.pageCount + '장'] : ['쪽 크기', pl.w ? `${pl.w} × ${pl.h}` : '—']],
    printCss: isPres ? '@page { size: landscape; margin: 0; }' : '@page { margin: 0; }',
    onDestroy() { conv.urls.forEach((u) => URL.revokeObjectURL(u)); },
  };
}
