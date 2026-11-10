/* 표 — 엑셀(xlsx·xlsm·xls)·ODS·CSV·TSV. SheetJS 로 읽어 머리글(A,B,C / 1,2,3) 이 붙은 표로 그린다. */
import { FlowView } from '../flow.js';
import { libs, el, escapeHtml, extOf } from '../util.js';
import { decodeText, ENCODING_LABEL } from '../text-decode.js';

const MAX_ROWS = 3000;
const MAX_COLS = 200;

function colName(c) {
  let s = '';
  c++;
  while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
  return s;
}

function sheetHtml(XLSX, ws) {
  if (!ws || !ws['!ref']) return { html: '<p class="empty-sheet">빈 시트입니다.</p>', cut: false, rows: 0, cols: 0 };
  const range = XLSX.utils.decode_range(ws['!ref']);
  const r0 = range.s.r, c0 = range.s.c;
  const r1 = Math.min(range.e.r, r0 + MAX_ROWS - 1);
  const c1 = Math.min(range.e.c, c0 + MAX_COLS - 1);
  const cut = range.e.r > r1 || range.e.c > c1;

  // 병합: 시작 칸 → [rowspan, colspan], 덮인 칸은 건너뛴다
  const span = new Map();
  const covered = new Set();
  for (const m of ws['!merges'] || []) {
    if (m.s.r > r1 || m.s.c > c1) continue;
    const rs = Math.min(m.e.r, r1) - m.s.r + 1, cs = Math.min(m.e.c, c1) - m.s.c + 1;
    span.set(m.s.r + ',' + m.s.c, [rs, cs]);
    for (let r = m.s.r; r <= Math.min(m.e.r, r1); r++)
      for (let c = m.s.c; c <= Math.min(m.e.c, c1); c++)
        if (r !== m.s.r || c !== m.s.c) covered.add(r + ',' + c);
  }

  const cols = ws['!cols'] || [];
  const rowsMeta = ws['!rows'] || [];
  const out = ['<table class="sheet"><colgroup><col class="rh">'];
  for (let c = c0; c <= c1; c++) {
    const ci = cols[c];
    const w = ci && (ci.wpx || (ci.wch ? ci.wch * 7 + 10 : 0));
    out.push(ci && ci.hidden ? '<col style="width:0">' : `<col${w ? ` style="width:${Math.round(w)}px"` : ''}>`);
  }
  out.push('</colgroup><thead><tr><th class="corner"></th>');
  for (let c = c0; c <= c1; c++) out.push(`<th>${colName(c)}</th>`);
  out.push('</tr></thead><tbody>');
  for (let r = r0; r <= r1; r++) {
    const rm = rowsMeta[r];
    if (rm && rm.hidden) continue;
    out.push(`<tr${rm && rm.hpx ? ` style="height:${Math.round(rm.hpx)}px"` : ''}><th>${r + 1}</th>`);
    for (let c = c0; c <= c1; c++) {
      const key = r + ',' + c;
      if (covered.has(key)) continue;
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const sp = span.get(key);
      const attrs = sp ? `${sp[0] > 1 ? ` rowspan="${sp[0]}"` : ''}${sp[1] > 1 ? ` colspan="${sp[1]}"` : ''}` : '';
      if (!cell) { out.push(`<td${attrs}></td>`); continue; }
      let text = cell.w != null ? cell.w : (cell.v == null ? '' : (cell.v instanceof Date ? cell.v.toLocaleDateString('ko-KR') : String(cell.v)));
      let inner = escapeHtml(text);
      if (cell.l && cell.l.Target && /^(https?:|mailto:)/i.test(cell.l.Target)) {
        inner = `<a href="${escapeHtml(cell.l.Target)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
      }
      const cls = cell.t === 'n' ? ' class="num"' : cell.t === 'b' ? ' class="bool"' : cell.t === 'e' ? ' class="err"' : '';
      const title = cell.f ? ` title="=${escapeHtml(cell.f)}"` : (text.length > 30 ? ` title="${escapeHtml(text)}"` : '');
      out.push(`<td${attrs}${cls}${title}>${inner}</td>`);
    }
    out.push('</tr>');
  }
  out.push('</tbody></table>');
  return { html: out.join(''), cut, rows: range.e.r - range.s.r + 1, cols: range.e.c - range.s.c + 1 };
}

export async function render(doc, container, ctx) {
  ctx.progress('표를 읽는 중…');
  const XLSX = await libs.xlsx();
  const ext = extOf(doc.name);
  const info = [];
  let wb;
  if (doc.kind === 'csv' || ext === 'csv' || ext === 'tsv') {
    const dec = decodeText(doc.bytes);
    info.push(['글자 인코딩', ENCODING_LABEL[dec.encoding] || dec.encoding]);
    wb = XLSX.read(dec.text, { type: 'string', raw: true, FS: ext === 'tsv' ? '\t' : undefined, dense: false });
  } else {
    wb = XLSX.read(doc.bytes, { type: 'array', cellDates: true, cellNF: false, cellStyles: false });
  }

  const names = wb.SheetNames;
  const meta = (wb.Workbook && wb.Workbook.Sheets) || [];
  const view = new FlowView(container, ctx.flowOpts({ className: 'sheet-flow', zoom: 1 }));
  const tabs = el('div', { class: 'sheet-tabs', role: 'tablist', 'aria-label': '시트' });
  const notice = el('div', { class: 'sheet-note', hidden: true });
  view.root.after(tabs);
  view.content.before(notice);
  container.classList.add('has-tabs');

  let active = -1;
  function show(i) {
    if (i === active) return;
    active = i;
    view.clearSearch();
    const res = sheetHtml(XLSX, wb.Sheets[names[i]]);
    view.content.innerHTML = res.html;
    notice.hidden = !res.cut;
    if (res.cut) notice.textContent = `이 시트는 ${res.rows.toLocaleString()}행 × ${res.cols}열로 커서 앞쪽 ${MAX_ROWS.toLocaleString()}행 · ${MAX_COLS}열만 보여 줍니다.`;
    [...tabs.children].forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
    view.root.scrollTop = 0; view.root.scrollLeft = 0;
    ctx.changed && ctx.changed();
  }
  names.forEach((nm, i) => {
    const hidden = meta[i] && meta[i].Hidden;
    tabs.appendChild(el('button', {
      type: 'button', role: 'tab', class: hidden ? 'hidden-sheet' : '', title: hidden ? '숨긴 시트' : nm,
      onclick: () => show(i),
    }, nm + (hidden ? ' (숨김)' : '')));
  });
  const firstVisible = names.findIndex((_, i) => !(meta[i] && meta[i].Hidden));
  show(firstVisible >= 0 ? firstVisible : 0);
  view.ready();

  info.unshift(['시트', `${names.length}개 — ${names.slice(0, 8).join(', ')}${names.length > 8 ? ' …' : ''}`]);
  return {
    flow: view,
    info,
    printCss: '@page { size: landscape; margin: 10mm; }',
    onDestroy() { tabs.remove(); notice.remove(); container.classList.remove('has-tabs'); },
  };
}
