/* 여러 모듈이 함께 쓰는 작은 도구들. */

export const $ = (id) => document.getElementById(id);

/** 요소 하나 만들기. el('div', {class: 'x', text: '...'}, child, child) */
export function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return e;
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatSize(n) {
  if (!(n >= 0)) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

export function extOf(name) {
  const m = String(name || '').match(/\.([A-Za-z0-9]+)$/);
  return m ? m[1].toLowerCase() : '';
}

/** 이 파일(js/)이 있는 폴더 기준이 아니라 index.html 기준 주소. */
export function at(rel) { return new URL(rel, document.baseURI).href; }

/* ---------------------------------------------------------------- 라이브러리 불러오기 */

const scriptCache = new Map();
/** 전역 변수를 만드는 UMD 스크립트를 한 번만 불러온다. */
export function loadScript(src, globalName) {
  const url = at(src);
  if (globalName && window[globalName]) return Promise.resolve(window[globalName]);
  if (scriptCache.has(url)) return scriptCache.get(url);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = () => resolve(globalName ? window[globalName] : true);
    s.onerror = () => { scriptCache.delete(url); reject(new Error('라이브러리를 불러오지 못했습니다: ' + src)); };
    document.head.appendChild(s);
  });
  scriptCache.set(url, p);
  return p;
}

const cssCache = new Set();
export function loadCss(href) {
  const url = at(href);
  if (cssCache.has(url)) return;
  cssCache.add(url);
  document.head.appendChild(el('link', { rel: 'stylesheet', href: url }));
}

export const libs = {
  jszip: () => loadScript('lib/jszip/jszip.min.js', 'JSZip'),
  xlsx: () => loadScript('lib/xlsx/xlsx.full.min.js', 'XLSX'),
  marked: () => loadScript('lib/marked/marked.min.js', 'marked'),
  purify: () => loadScript('lib/dompurify/purify.min.js', 'DOMPurify'),
  hljs: () => loadScript('lib/hljs/highlight.min.js', 'hljs'),
  katex: () => { loadCss('lib/katex/katex.min.css'); return loadScript('lib/katex/katex.min.js', 'katex'); },
  docx: async () => { await libs.jszip(); return loadScript('lib/docx-preview/docx-preview.min.js', 'docx'); },
  heic: () => loadScript('lib/heic2any/heic2any.min.js', 'heic2any'),
  utif: () => loadScript('lib/utif/UTIF.js', 'UTIF'),
};

/* ---------------------------------------------------------------- 안전하게 넣기 */

/** 문서에서 나온 HTML·SVG 를 넣기 전에 스크립트·이벤트·javascript: 링크를 걷어낸다. */
export async function sanitize(html, opts) {
  const P = await libs.purify();
  return P.sanitize(html, Object.assign({
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
  }, opts || {}));
}

/** 링크는 새 창으로, 위험한 주소는 끊는다. */
export function hardenLinks(root) {
  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (/^\s*(javascript|vbscript|data):/i.test(href)) { a.removeAttribute('href'); return; }
    if (href.startsWith('#')) return;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

/* ---------------------------------------------------------------- 내려받기 */

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name || 'download' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** 화면을 한 번 그릴 틈을 준다 (긴 작업 사이에 진행 표시가 보이게). */
export function nextFrame() { return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); }

/** UTF-8 로 읽되 깨지면 한글 완성형으로. 짧은 XML/텍스트 조각용. */
export function decodeUtf8(bytes) { return new TextDecoder('utf-8').decode(bytes); }

/** 글자 찾기용으로 공백 차이를 무시한 비교 문자열. */
export function norm(s) { return String(s || '').toLocaleLowerCase(); }

/** 문자열 안에서 q 가 나오는 자리 수. */
export function countMatches(text, q) {
  if (!q) return 0;
  const t = norm(text), n = norm(q);
  let c = 0, i = 0;
  while ((i = t.indexOf(n, i)) !== -1) { c++; i += n.length; }
  return c;
}
