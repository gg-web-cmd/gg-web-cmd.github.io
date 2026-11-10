/* 글 문서 — 텍스트·소스 코드·JSON·마크다운·HTML·주피터 노트북(.ipynb).
 * 한국에서 도는 텍스트 파일은 UTF-8 아니면 CP949 라서 인코딩을 먼저 알아낸다. */
import { FlowView } from '../flow.js';
import { libs, el, escapeHtml, extOf, hardenLinks, sanitize } from '../util.js';
import { decodeText, ENCODING_LABEL } from '../text-decode.js';

const HL_LANG = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', pyw: 'python', java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp',
  go: 'go', rs: 'rust', rb: 'ruby', php: 'php', kt: 'kotlin', swift: 'swift', scala: 'scala', r: 'r',
  sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell', bat: 'dos', cmd: 'dos',
  css: 'css', scss: 'scss', less: 'less', html: 'xml', htm: 'xml', xml: 'xml', svg: 'xml', xsl: 'xml',
  json: 'json', jsonc: 'json', geojson: 'json', yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', cfg: 'ini',
  conf: 'ini', properties: 'properties', md: 'markdown', tex: 'latex', lua: 'lua', pl: 'perl', vb: 'vbnet',
  vbs: 'vbscript', dart: 'dart', m: 'objectivec', gradle: 'gradle', dockerfile: 'dockerfile', makefile: 'makefile',
  diff: 'diff', patch: 'diff', gs: 'javascript', ino: 'cpp', asm: 'x86asm', s: 'x86asm',
};
const HL_MAX = 600 * 1024;

/** 인코딩 고르기 + 줄바꿈 켜고 끄기 띠 */
function textBar(view, dec, opts) {
  const sel = el('select', { 'aria-label': '글자 인코딩' });
  const encs = ['utf-8', 'euc-kr', 'utf-16le', 'utf-16be', 'shift_jis', 'gb18030', 'big5'];
  for (const e of encs) sel.appendChild(el('option', { value: e, selected: (dec.encoding === e || (dec.encoding === 'us-ascii' && e === 'utf-8')) ? true : null }, ENCODING_LABEL[e] || e));
  sel.addEventListener('change', () => opts.onEncoding(sel.value));
  const bar = el('div', { class: 'text-bar' },
    el('label', null, '인코딩 ', sel),
    opts.wrap !== undefined ? el('label', null, el('input', { type: 'checkbox', checked: opts.wrap ? true : null, onchange: (e) => opts.onWrap(e.target.checked) }), ' 긴 줄 접기') : null,
    opts.extra || null,
  );
  view.root.before(bar);
  return bar;
}

function decodeAs(bytes, enc) {
  try { return new TextDecoder(enc).decode(bytes); } catch (_) { return new TextDecoder().decode(bytes); }
}

/* ------------------------------------------------------------------ 텍스트·코드 */

export async function renderText(doc, container, ctx) {
  const ext = extOf(doc.name);
  const dec = decodeText(doc.bytes);
  let text = dec.text;
  const view = new FlowView(container, ctx.flowOpts({ className: 'text-flow', zoom: 1 }));
  const pre = el('pre', { class: 'text wrap' });
  const code = el('code');
  pre.appendChild(code);
  view.content.appendChild(pre);

  let lang = HL_LANG[ext] || (/^(dockerfile|makefile)$/i.test(doc.name) ? doc.name.toLowerCase() : null);
  async function paint(t) {
    if (ext === 'json' || ext === 'geojson') {
      try { t = JSON.stringify(JSON.parse(t), null, 2); } catch (_) {}
    }
    code.textContent = t;
    code.className = '';
    if (lang && t.length < HL_MAX) {
      try {
        const hljs = await libs.hljs();
        if (hljs.getLanguage(lang)) {
          code.innerHTML = hljs.highlight(t, { language: lang, ignoreIllegals: true }).value;
          code.className = 'hljs';
        }
      } catch (_) {}
    }
  }
  await paint(text);
  const bar = textBar(view, dec, {
    wrap: true,
    onWrap: (w) => pre.classList.toggle('wrap', w),
    onEncoding: async (e) => { text = decodeAs(doc.bytes, e); await paint(text); },
  });
  view.ready();
  const lines = (text.match(/\n/g) || []).length + 1;
  return {
    flow: view,
    info: [['글자 인코딩', (ENCODING_LABEL[dec.encoding] || dec.encoding) + (dec.confidence === 'low' ? ' (추정)' : '')], ['줄 수', lines.toLocaleString() + '줄'], ['글자 수', text.length.toLocaleString() + '자']],
    onDestroy() { bar.remove(); },
    getText: () => text,
  };
}

/* ------------------------------------------------------------------ 마크다운 */

/** $…$, $$…$$ 를 KaTeX 로. 코드 안의 $ 는 건드리지 않는다. */
function protectMath(src) {
  const math = [];
  const codes = [];
  let s = src.replace(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g, (m) => { codes.push(m); return `@@CODE${codes.length - 1}@@`; });
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (m, tex) => { math.push({ tex, display: true }); return `@@MATH${math.length - 1}@@`; });
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (m, tex) => { math.push({ tex, display: true }); return `@@MATH${math.length - 1}@@`; });
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (m, tex) => { math.push({ tex, display: false }); return `@@MATH${math.length - 1}@@`; });
  s = s.replace(/(^|[^\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/g, (m, pre, tex) => { math.push({ tex, display: false }); return `${pre}@@MATH${math.length - 1}@@`; });
  s = s.replace(/@@CODE(\d+)@@/g, (m, i) => codes[+i]);
  return { s, math };
}

export async function markdownToHtml(src) {
  const [marked] = await Promise.all([libs.marked(), libs.purify()]);
  let body = src.replace(/^---\n[\s\S]*?\n---\n/, ''); // 앞머리(front matter) 빼기
  const { s, math } = protectMath(body);
  let html = marked.parse(s, { gfm: true, breaks: false });
  html = await sanitize(html, { FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select'], ADD_ATTR: ['target', 'checked', 'disabled', 'type'] });
  if (math.length) {
    let katex = null;
    try { katex = await libs.katex(); } catch (_) {}
    html = html.replace(/@@MATH(\d+)@@/g, (m, i) => {
      const it = math[+i];
      if (!katex) return escapeHtml(it.display ? `$$${it.tex}$$` : `$${it.tex}$`);
      try { return katex.renderToString(it.tex, { displayMode: it.display, throwOnError: false, trust: false, strict: 'ignore' }); }
      catch (_) { return escapeHtml(it.tex); }
    });
  }
  return html;
}

async function highlightCode(root) {
  const blocks = root.querySelectorAll('pre code');
  if (!blocks.length) return;
  try {
    const hljs = await libs.hljs();
    blocks.forEach((b) => {
      if (b.textContent.length > HL_MAX) return;
      const m = /language-([\w-]+)/.exec(b.className);
      if (m && !hljs.getLanguage(m[1])) b.className = '';
      try { hljs.highlightElement(b); } catch (_) {}
    });
  } catch (_) {}
}

export async function renderMarkdown(doc, container, ctx) {
  const dec = decodeText(doc.bytes);
  let text = dec.text;
  const view = new FlowView(container, ctx.flowOpts({ className: 'md-flow', zoom: 1 }));
  const article = el('article', { class: 'md-body' });
  view.content.appendChild(article);
  const srcPre = el('pre', { class: 'text wrap', hidden: true });
  view.content.appendChild(srcPre);
  async function paint() {
    article.innerHTML = await markdownToHtml(text);
    hardenLinks(article);
    srcPre.textContent = text;
    await highlightCode(article);
  }
  await paint();
  const toggle = el('label', null, el('input', { type: 'checkbox', onchange: (e) => { srcPre.hidden = !e.target.checked; article.hidden = e.target.checked; view.clearSearch(); } }), ' 원문(마크다운) 보기');
  const bar = textBar(view, dec, { onEncoding: async (e) => { text = decodeAs(doc.bytes, e); await paint(); }, extra: toggle });
  view.ready();
  const heads = article.querySelectorAll('h1, h2, h3').length;
  return {
    flow: view,
    info: [['글자 인코딩', ENCODING_LABEL[dec.encoding] || dec.encoding], ['제목 수', heads + '개'], ['글자 수', text.length.toLocaleString() + '자']],
    onDestroy() { bar.remove(); },
    getText: () => text,
  };
}

/* ------------------------------------------------------------------ HTML */

export async function renderHtml(doc, container, ctx) {
  const dec = decodeText(doc.bytes);
  let text = dec.text;
  const P = await libs.purify();
  const view = new FlowView(container, ctx.flowOpts({ className: 'html-flow', zoom: 1 }));
  const frame = el('iframe', {
    class: 'html-frame', title: doc.name,
    // 스크립트는 절대 돌지 않는다(allow-scripts 없음). 같은 출처는 높이를 재고 인쇄하려고만 쓴다.
    sandbox: 'allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox',
  });
  const srcPre = el('pre', { class: 'text wrap', hidden: true });
  view.content.append(frame, srcPre);

  function fit() {
    try {
      const d = frame.contentDocument;
      if (!d) return;
      frame.style.height = Math.max(300, d.documentElement.scrollHeight + 4) + 'px';
      d.querySelectorAll('a[href]').forEach((a) => { if (!a.getAttribute('href').startsWith('#')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } });
    } catch (_) {}
  }
  function paint() {
    const clean = P.sanitize(text, { WHOLE_DOCUMENT: true, ADD_TAGS: ['style'], FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'meta', 'base', 'link'], ADD_ATTR: ['target'] });
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: https: http:; style-src 'unsafe-inline' https:; font-src data: https:; media-src data: blob: https:">`;
    frame.srcdoc = clean.replace(/<head([^>]*)>/i, `<head$1>${csp}<meta charset="utf-8">`).replace(/^(?![\s\S]*<head)/, `${csp}<meta charset="utf-8">`);
    srcPre.textContent = text;
  }
  frame.addEventListener('load', () => { fit(); setTimeout(fit, 400); });
  paint();
  const toggle = el('label', null, el('input', { type: 'checkbox', onchange: (e) => { srcPre.hidden = !e.target.checked; frame.hidden = e.target.checked; } }), ' 소스 보기');
  const bar = textBar(view, dec, { onEncoding: (e) => { text = decodeAs(doc.bytes, e); paint(); }, extra: toggle });
  view.ready();
  return {
    flow: view,
    info: [['글자 인코딩', ENCODING_LABEL[dec.encoding] || dec.encoding], ['보안', '페이지 안의 스크립트는 실행하지 않습니다.']],
    onDestroy() { bar.remove(); },
    printFrame: frame,
    getText: () => text,
  };
}

/* ------------------------------------------------------------------ 주피터 노트북 */

const ansi = (s) => String(s).replace(/\u001b\[[0-9;]*m/g, '');
const joinSrc = (v) => Array.isArray(v) ? v.join('') : String(v || '');

export async function renderNotebook(doc, container, ctx) {
  const dec = decodeText(doc.bytes);
  let nb;
  try { nb = JSON.parse(dec.text); } catch (e) { throw new Error('노트북(.ipynb) 내용을 읽지 못했습니다: ' + e.message); }
  const cells = nb.cells || (nb.worksheets && nb.worksheets[0] && nb.worksheets[0].cells) || [];
  const lang = (nb.metadata && (nb.metadata.language_info && nb.metadata.language_info.name || nb.metadata.kernelspec && nb.metadata.kernelspec.language)) || 'python';
  const view = new FlowView(container, ctx.flowOpts({ className: 'nb-flow', zoom: 1 }));
  const wrap = el('div', { class: 'nb' });
  view.content.appendChild(wrap);
  const P = await libs.purify();
  for (const c of cells) {
    const srcText = joinSrc(c.source || c.input);
    if (c.cell_type === 'markdown') {
      const d = el('div', { class: 'nb-md md-body' });
      d.innerHTML = await markdownToHtml(srcText);
      hardenLinks(d);
      wrap.appendChild(d);
      continue;
    }
    if (c.cell_type !== 'code') { wrap.appendChild(el('pre', { class: 'nb-raw' }, srcText)); continue; }
    const n = c.execution_count != null ? c.execution_count : ' ';
    const codeEl = el('code', { class: 'language-' + lang }, srcText);
    wrap.appendChild(el('div', { class: 'nb-cell' }, el('div', { class: 'nb-prompt', text: `In [${n}]:` }), el('pre', { class: 'nb-code' }, codeEl)));
    for (const o of c.outputs || []) {
      const out = el('div', { class: 'nb-out' });
      if (o.output_type === 'stream') out.appendChild(el('pre', { class: o.name === 'stderr' ? 'err' : '' }, ansi(joinSrc(o.text))));
      else if (o.output_type === 'error') out.appendChild(el('pre', { class: 'err' }, ansi((o.traceback || []).join('\n') || `${o.ename}: ${o.evalue}`)));
      else {
        const d = o.data || {};
        const img = d['image/png'] || d['image/jpeg'] || d['image/gif'];
        if (img) {
          const mime = d['image/png'] ? 'image/png' : d['image/jpeg'] ? 'image/jpeg' : 'image/gif';
          out.appendChild(el('img', { src: `data:${mime};base64,${joinSrc(img).replace(/\s/g, '')}`, alt: '출력 그림' }));
        } else if (d['image/svg+xml']) {
          out.appendChild(el('img', { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(joinSrc(d['image/svg+xml'])), alt: '출력 그림' }));
        } else if (d['text/html']) {
          const h = el('div', { class: 'nb-html' });
          h.innerHTML = P.sanitize(joinSrc(d['text/html']), { FORBID_TAGS: ['style', 'script', 'form'] });
          out.appendChild(h);
        } else if (d['text/markdown']) {
          const h = el('div', { class: 'md-body' });
          h.innerHTML = await markdownToHtml(joinSrc(d['text/markdown']));
          out.appendChild(h);
        } else if (d['text/plain']) {
          out.appendChild(el('pre', null, ansi(joinSrc(d['text/plain']))));
        }
      }
      if (out.childNodes.length) {
        if (o.execution_count != null) out.prepend(el('div', { class: 'nb-prompt out', text: `Out[${o.execution_count}]:` }));
        wrap.appendChild(out);
      }
    }
  }
  await highlightCode(wrap);
  view.ready();
  const codeCells = cells.filter((c) => c.cell_type === 'code').length;
  return { flow: view, info: [['셀', `${cells.length}개 (코드 ${codeCells}개)`], ['언어', lang]] };
}
