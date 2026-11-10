/* 옛 형식 — 워드 97-2003(.doc)·파워포인트 97-2003(.ppt)·RTF.
 * 모양 그대로 그리는 브라우저 도구가 없어서 글(과 .ppt 의 그림)을 꺼내 읽기 좋게 보여 준다. */
import { FlowView } from '../flow.js';
import { libs, el } from '../util.js';

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function cfbRead(bytes) {
  const XLSX = await libs.xlsx();
  const cfb = XLSX.CFB.read(bytes, { type: 'array' });
  const get = (name) => {
    const e = XLSX.CFB.find(cfb, name);
    if (!e || !e.content) return null;
    return e.content instanceof Uint8Array ? e.content : Uint8Array.from(e.content);
  };
  return { get };
}

/* ------------------------------------------------------------------ .doc */

/** cp1252 의 0x80~0x9F 칸 (압축 조각용) */
const CP1252 = [0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178];

export function docText(word, table0, table1) {
  if (u16(word, 0) !== 0xa5ec) throw new Error('워드 문서 머리(FIB)가 올바르지 않습니다.');
  const flags = u16(word, 0x0a);
  if (flags & 0x0100) throw new Error('암호가 걸린 워드 문서는 열 수 없습니다.');
  const table = (flags & 0x0200) ? table1 : table0;
  if (!table) throw new Error('워드 문서의 표 스트림이 없습니다.');
  const ccpText = u32(word, 0x4c);
  const fcClx = u32(word, 0x1a2), lcbClx = u32(word, 0x1a6);
  let p = fcClx;
  const end = fcClx + lcbClx;
  while (p < end && table[p] === 0x01) p += 3 + u16(table, p + 1); // Prc 건너뛰기
  if (table[p] !== 0x02) throw new Error('워드 문서의 조각표(CLX)를 찾지 못했습니다.');
  const lcb = u32(table, p + 1);
  const base = p + 5;
  const n = (lcb - 4) / 12;
  let out = '';
  for (let k = 0; k < n; k++) {
    const cp0 = u32(table, base + k * 4), cp1 = u32(table, base + (k + 1) * 4);
    if (cp0 >= ccpText) break;
    const len = Math.min(cp1, ccpText) - cp0;
    const pcd = base + (n + 1) * 4 + k * 8;
    const fcv = u32(table, pcd + 2);
    const compressed = (fcv & 0x40000000) !== 0;
    const fc = fcv & 0x3fffffff;
    if (compressed) {
      const off = fc / 2;
      let s = '';
      for (let i = 0; i < len; i++) {
        const c = word[off + i];
        s += String.fromCharCode(c >= 0x80 && c <= 0x9f ? CP1252[c - 0x80] : c);
      }
      out += s;
    } else {
      out += new TextDecoder('utf-16le').decode(word.subarray(fc, fc + len * 2));
    }
  }
  // 필드: \x13 지시문 \x14 결과 \x15 → 결과만
  let prev;
  do { prev = out; out = out.replace(/\x13[^\x13\x14\x15]*\x14([^\x13\x15]*)\x15/g, '$1').replace(/\x13[^\x13\x14\x15]*\x15/g, ''); } while (out !== prev);
  return out
    .replace(/\x07\x07/g, '\x07\n')    // 칸 끝 + 줄 끝 → 표 한 줄 끝 (빈 칸과 헷갈릴 수 있다)
    .replace(/[\r\x0b]/g, '\n')
    .replace(/\x0c/g, '\n\n')
    .replace(/[\x00-\x06\x08\x0e-\x1f]/g, '')
    .replace(/\n{4,}/g, '\n\n\n');
}

/* ------------------------------------------------------------------ .ppt */

function pptSlides(ppt) {
  const slides = [];   // [[text, ...], ...]
  // 1) SlideListWithText(0x0FF0, instance 0) 안의 글
  function walk(o, endo, cb, depth) {
    while (o + 8 <= endo) {
      const verInst = u16(ppt, o), type = u16(ppt, o + 2), len = u32(ppt, o + 4);
      const ver = verInst & 0xf, inst = verInst >> 4;
      if (len > endo - o - 8) break;
      cb(type, inst, o + 8, len, depth);
      if (ver === 0xf && depth < 12) walk(o + 8, o + 8 + len, cb, depth + 1);
      o += 8 + len;
    }
  }
  const textOf = (type, at, len) => type === 0x0fa0
    ? new TextDecoder('utf-16le').decode(ppt.subarray(at, at + len))
    : new TextDecoder('windows-1252').decode(ppt.subarray(at, at + len));

  let inSlw = -1, cur = null;
  const slwSlides = [];
  walk(0, ppt.length, (type, inst, at, len, depth) => {
    if (type === 0x0ff0) { inSlw = inst === 0 ? depth : -1; return; }
    if (inSlw >= 0 && depth > inSlw) {
      if (type === 0x03f3) { cur = []; slwSlides.push(cur); }
      else if ((type === 0x0fa0 || type === 0x0fa8) && cur) cur.push(textOf(type, at, len));
    }
  }, 0);

  // 2) 슬라이드 그림판(0x03EE) 안 글상자 — 2007 이후에 저장한 .ppt 는 글이 이쪽에만 있다
  const boxSlides = [];
  let slideDepth = -1, cur2 = null;
  walk(0, ppt.length, (type, inst, at, len, depth) => {
    if (type === 0x03ee) { slideDepth = depth; cur2 = []; boxSlides.push(cur2); return; }
    if (slideDepth >= 0 && depth <= slideDepth && type !== 0x03ee) slideDepth = -1;
    if (slideDepth >= 0 && cur2 && (type === 0x0fa0 || type === 0x0fa8)) cur2.push(textOf(type, at, len));
  }, 0);
  const count = (arr) => arr.reduce((s, a) => s + a.join('').trim().length, 0);
  const best = count(boxSlides) > count(slwSlides) ? boxSlides : slwSlides;
  for (const s of best) slides.push(s.map((t) => t.replace(/\r/g, '\n').replace(/\x0b/g, '\n')));
  return slides;
}

/** Pictures 스트림의 그림(BLIP)들 */
function pptPictures(pics) {
  const out = [];
  if (!pics) return out;
  let o = 0;
  while (o + 8 <= pics.length && out.length < 200) {
    const verInst = u16(pics, o), type = u16(pics, o + 2), len = u32(pics, o + 4);
    const inst = verInst >> 4;
    const body = o + 8;
    if (len <= 0 || body + len > pics.length) break;
    let mime = null, skip = 0;
    if (type === 0xf01d || type === 0xf02a) { mime = 'image/jpeg'; skip = (inst === 0x46b || inst === 0x6e3) ? 33 : 17; }
    else if (type === 0xf01e) { mime = 'image/png'; skip = inst === 0x6e1 ? 33 : 17; }
    if (mime) out.push(new Blob([pics.subarray(body + skip, body + len)], { type: mime }));
    o = body + len;
  }
  return out;
}

/* ------------------------------------------------------------------ RTF */

export function rtfText(bytes) {
  const s = new TextDecoder('latin1').decode(bytes);
  let cp = 'windows-1252';
  const m = /\\ansicpg(\d+)/.exec(s);
  if (m) cp = m[1] === '949' ? 'euc-kr' : m[1] === '932' ? 'shift_jis' : m[1] === '936' ? 'gbk' : m[1] === '950' ? 'big5' : 'windows-' + m[1];
  let dec;
  try { dec = new TextDecoder(cp); } catch (_) { dec = new TextDecoder('windows-1252'); }
  const SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|object|header|footer|headerl|headerr|footerl|footerr|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|themedata|colorschememapping|latentstyles|datastore|fldinst|bkmkstart|bkmkend|filetbl|revtbl|mmathPr|wgrffmtfilter|pgdsctbl)$/;
  const stack = [];
  let skip = false, uc = 1, pendingSkip = 0;
  let out = '';
  let bytesBuf = [];
  const flush = () => { if (bytesBuf.length) { out += dec.decode(new Uint8Array(bytesBuf)); bytesBuf = []; } };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{') { stack.push({ skip, uc }); continue; }
    if (c === '}') { flush(); const st = stack.pop(); if (st) { skip = st.skip; uc = st.uc; } continue; }
    if (c === '\\') {
      const n = s[i + 1];
      if (n === '\\' || n === '{' || n === '}') { flush(); if (!skip) out += n; i++; continue; }
      if (n === "'") {
        const hex = s.substr(i + 2, 2);
        i += 3;
        if (pendingSkip > 0) { pendingSkip--; continue; }
        if (!skip) bytesBuf.push(parseInt(hex, 16));
        continue;
      }
      if (n === '*') { skip = true; i++; continue; }
      if (n === '~') { flush(); if (!skip) out += ' '; i++; continue; }
      if (n === '-' || n === '_') { i++; continue; }
      if (n === '\n' || n === '\r') { flush(); if (!skip) out += '\n'; i++; continue; }
      const mm = /^([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i + 1, i + 40));
      if (!mm) { i++; continue; }
      i += mm[0].length;
      const word = mm[1], arg = mm[2] != null ? +mm[2] : null;
      flush();
      if (SKIP.test(word)) { skip = true; continue; }
      if (skip) continue;
      if (word === 'par' || word === 'line' || word === 'sect' || word === 'row') out += '\n';
      else if (word === 'page') out += '\n\n';
      else if (word === 'tab' || word === 'cell') out += '\t';
      else if (word === 'uc') uc = arg || 0;
      else if (word === 'u') { out += String.fromCharCode(arg < 0 ? arg + 65536 : arg); pendingSkip = uc; }
      else if (word === 'emdash') out += '—';
      else if (word === 'endash') out += '–';
      else if (word === 'bullet') out += '•';
      else if (word === 'lquote') out += '‘';
      else if (word === 'rquote') out += '’';
      else if (word === 'ldblquote') out += '“';
      else if (word === 'rdblquote') out += '”';
      continue;
    }
    if (c === '\r' || c === '\n') continue;
    if (pendingSkip > 0) { pendingSkip--; continue; }
    if (!skip) { flush(); out += c; }
  }
  flush();
  return out.replace(/\n{4,}/g, '\n\n\n').trim();
}

/* ------------------------------------------------------------------ 그리기 */

/** 글 → 문단. \x07 로 나뉜 줄은 워드 표의 한 줄로 보고 표로 그린다. */
function textPage(view, text) {
  const page = el('div', { class: 'legacy-page' });
  let table = null;
  for (const para of text.split('\n')) {
    if (para.includes('\x07')) {
      if (!table) { table = el('table', { class: 'legacy-table' }); page.appendChild(table); }
      const cells = para.replace(/\x07$/, '').split('\x07');
      table.appendChild(el('tr', null, cells.map((c) => el('td', { text: c }))));
      continue;
    }
    table = null;
    page.appendChild(para.trim() ? el('p', { text: para }) : el('p', { class: 'blank' }, el('br')));
  }
  view.content.appendChild(page);
}

export async function render(doc, container, ctx) {
  ctx.progress('글을 꺼내는 중…');
  const view = new FlowView(container, ctx.flowOpts({ className: 'legacy-flow', pageSelector: '.ppt-slide', zoom: 1 }));
  const info = [];
  let note;
  if (doc.kind === 'rtf') {
    const t = rtfText(doc.bytes);
    textPage(view, t);
    info.push(['글자 수', t.length.toLocaleString() + '자']);
    note = 'RTF 는 글만 보여 줍니다 (글자 모양·그림 제외).';
  } else if (doc.kind === 'doc') {
    const cfb = await cfbRead(doc.bytes);
    const word = cfb.get('WordDocument');
    if (!word) throw new Error('워드 본문 스트림이 없습니다.');
    const t = docText(word, cfb.get('0Table'), cfb.get('1Table'));
    textPage(view, t);
    info.push(['글자 수', t.length.toLocaleString() + '자']);
    note = '워드 97-2003(.doc)은 글만 꺼내 보여 줍니다. 모양 그대로 보려면 워드에서 .docx 나 PDF 로 저장해 열어 주세요.';
  } else if (doc.kind === 'ppt') {
    const cfb = await cfbRead(doc.bytes);
    const ppt = cfb.get('PowerPoint Document');
    if (!ppt) throw new Error('파워포인트 본문 스트림이 없습니다.');
    const slides = pptSlides(ppt);
    slides.forEach((texts, i) => {
      const card = el('section', { class: 'ppt-slide slide-card' }, el('h3', { text: `슬라이드 ${i + 1}` }));
      for (const t of texts) for (const line of t.split('\n')) if (line.trim()) card.appendChild(el('p', { text: line }));
      view.content.appendChild(card);
    });
    const pics = pptPictures(cfb.get('Pictures'));
    if (pics.length) {
      const g = el('section', { class: 'ppt-pics' }, el('h3', { text: `문서에 든 그림 ${pics.length}장` }));
      pics.forEach((b) => g.appendChild(el('img', { src: URL.createObjectURL(b), alt: '', loading: 'lazy' })));
      view.content.appendChild(g);
    }
    info.push(['슬라이드', slides.length + '장'], ['그림', pics.length + '장']);
    note = '파워포인트 97-2003(.ppt)은 슬라이드별 글과 들어 있는 그림만 보여 줍니다. 모양 그대로 보려면 .pptx 나 PDF 로 저장해 열어 주세요.';
  }
  view.ready();
  return { flow: view, info, note };
}
