/**
 * HWP / HWPX 렌더링 엔진 래퍼.
 *
 * vendor/rhwp 는 @rhwp/core (MIT) 의 Rust→WebAssembly 빌드다. 파서가 아니라
 * 레이아웃 엔진이어서 페이지 나눔까지 직접 계산하고, 페이지 단위로
 * 절대 배치된 HTML 또는 벡터 SVG를 내놓는다. 그림은 data: URI로 이미 박혀
 * 나오므로 별도 자산 처리가 필요 없다.
 *
 * .hwp(바이너리 CFB) 와 .hwpx(OWPML ZIP) 를 같은 클래스가 모두 받는다.
 *
 * 반드시 지켜야 할 순서: measureTextWidth 를 먼저 설치한 뒤 문서를 만든다.
 * 레이아웃 계산 중에 호스트로 콜백하기 때문이다.
 */

import { installMeasurer } from "./measure.js";

let enginePromise = null;
let wasmExports = null;
let measurer = null;

/** Node 인지. 브라우저·WKWebView 에서는 false. */
function isNode() {
  return typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null;
}

/**
 * WASM 엔진을 한 번만 초기화한다.
 * @param {object} [opts]
 * @param {string|URL|ArrayBuffer|Uint8Array} [opts.wasm] wasm 위치 또는 바이트.
 *        생략하면 vendor/rhwp/rhwp_bg.wasm 을 rhwp.js 기준 상대경로로 가져온다.
 * @param {string|URL} [opts.moduleUrl] rhwp.js 위치. 기본값은 vendor 경로.
 */
export function initEngine(opts) {
  if (enginePromise) return enginePromise;
  const o = opts || {};
  enginePromise = (async () => {
    // 레이아웃 계산이 호스트 콜백을 쓰므로 모듈을 만들기 전에 설치한다.
    measurer = installMeasurer();
    const moduleUrl = o.moduleUrl || new URL("../lib/rhwp/rhwp.js", import.meta.url);
    const mod = await import(String(moduleUrl));

    // wasm 을 어떻게 넘길지는 환경에 따라 다르다.
    // 브라우저·WKWebView: URL 을 주면 fetch + instantiateStreaming 으로 가져간다.
    // Node: 기본값이 file:// URL 인데 Node 의 fetch 는 file:// 를 지원하지 않아
    //       "not implemented... yet..." 로 죽는다. 그래서 바이트를 직접 읽어 준다.
    let wasm = o.wasm;
    if (wasm === undefined) {
      // wasm 은 rhwp.js 바로 옆에 있다 (wasm-bindgen 의 기본 배치).
      const wasmUrl = new URL("rhwp_bg.wasm", moduleUrl);
      if (wasmUrl.protocol === "file:" && isNode()) {
        const { readFile } = await import("node:fs/promises");
        const { fileURLToPath } = await import("node:url");
        wasm = await readFile(fileURLToPath(wasmUrl));
      } else {
        wasm = wasmUrl;
      }
    }
    await mod.default({ module_or_path: wasm });
    if (typeof mod.init_panic_hook === "function") {
      // Rust 패닉이 났을 때 콘솔에 스택이 남게 한다. 없으면 "unreachable"만 보인다.
      try { mod.init_panic_hook(); } catch (_) { /* 없으면 그냥 넘어간다 */ }
    }
    wasmExports = mod;
    return mod;
  })();
  return enginePromise;
}

/** 엔진 버전. 진단용. */
export async function engineVersion() {
  const mod = await initEngine();
  try { return mod.version(); } catch (_) { return "unknown"; }
}

/** 측정기 통계(캐시 적중률 등). 성능 진단용. */
export function measurerStats() {
  return measurer ? measurer.stats() : null;
}

/**
 * 열린 한글 문서 하나.
 *
 * 페이지를 미리 다 렌더하지 않는다. 600쪽 문서를 한 번에 렌더하면 66MB짜리
 * HTML이 나오고 WKWebView 콘텐츠 프로세스가 죽는다. 요청받은 페이지만 렌더하고
 * 결과를 작은 캐시에 담는다.
 */
export class HwpFile {
  /**
   * @param {Uint8Array|ArrayBuffer} bytes 파일 전체 바이트
   * @param {object} [opts]
   * @param {number} [opts.pageCacheSize] 렌더 결과를 몇 쪽까지 들고 있을지 (기본 6)
   * @param {string} [opts.password] 암호 문서일 때
   */
  constructor(bytes, opts) {
    if (!wasmExports) throw new Error("initEngine() 을 먼저 호출해야 합니다.");
    const o = opts || {};
    const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this._doc = o.password != null
      ? wasmExports.HwpDocument.openWithPassword(buf, o.password)
      : new wasmExports.HwpDocument(buf);
    this._cache = new Map();
    this._cacheLimit = o.pageCacheSize || 6;
    this._info = null;
  }

  /** 'hwp' 또는 'hwpx'. */
  get sourceFormat() {
    try { return this._doc.getSourceFormat(); } catch (_) { return "unknown"; }
  }

  /** 총 페이지 수. */
  get pageCount() {
    return this._doc.pageCount();
  }

  /** 구역(section) 수. */
  get sectionCount() {
    try { return this._doc.getSectionCount(); } catch (_) { return 1; }
  }

  /**
   * 문서 메타데이터.
   * @returns {{version: string, sectionCount: number, pageCount: number,
   *            encrypted: boolean, fontsUsed: string[]}}
   */
  get info() {
    if (this._info) return this._info;
    let parsed = {};
    try { parsed = JSON.parse(this._doc.getDocumentInfo()); } catch (_) { /* 비어 있으면 기본값 */ }
    this._info = {
      version: parsed.version || "",
      sectionCount: parsed.sectionCount || this.sectionCount,
      pageCount: parsed.pageCount || this.pageCount,
      encrypted: !!parsed.encrypted,
      fontsUsed: Array.isArray(parsed.fontsUsed) ? parsed.fontsUsed : [],
    };
    return this._info;
  }

  /** 파서가 남긴 경고 개수. 0이 아니면 표시가 원본과 다를 수 있다. */
  get warningCount() {
    try { return (JSON.parse(this._doc.getValidationWarnings()) || {}).count || 0; }
    catch (_) { return 0; }
  }

  /**
   * 페이지 크기(px). 모든 페이지가 같다고 보지 않고 요청한 페이지 기준으로 준다.
   * @param {number} pageIndex 0부터
   */
  pageSize(pageIndex) {
    const html = this.renderPageHtml(pageIndex);
    const w = html.match(/width:([0-9.]+)px/);
    const h = html.match(/height:([0-9.]+)px/);
    return { width: w ? parseFloat(w[1]) : 793.7, height: h ? parseFloat(h[1]) : 1122.5 };
  }

  /**
   * 한 페이지를 HTML로 렌더한다. 절대 배치된 div/span 이고 그림은 data: URI다.
   * @param {number} pageIndex 0부터
   * @returns {string}
   */
  renderPageHtml(pageIndex) {
    const key = "h" + pageIndex;
    const hit = this._cache.get(key);
    if (hit !== undefined) return hit;
    const html = this._doc.renderPageHtml(pageIndex);
    this._put(key, html);
    return html;
  }

  /**
   * 한 페이지를 SVG로 렌더한다. 확대해도 글자가 깨지지 않지만 HTML보다 크고
   * 텍스트 선택이 불편하다. 인쇄/내보내기용.
   * @param {number} pageIndex 0부터
   * @returns {string}
   */
  renderPageSvg(pageIndex) {
    const key = "s" + pageIndex;
    const hit = this._cache.get(key);
    if (hit !== undefined) return hit;
    const svg = this._doc.renderPageSvg(pageIndex);
    this._put(key, svg);
    return svg;
  }

  /**
   * 문서 전체에서 문자열을 찾는다.
   * @param {string} query
   * @param {object} [opts]
   * @param {boolean} [opts.caseSensitive=false]
   * @param {boolean} [opts.includeCells=true] 표 안까지 찾을지
   * @returns {Array<object>} 위치 목록 (구역/문단/문자 오프셋)
   */
  search(query, opts) {
    const o = opts || {};
    if (!query) return [];
    try {
      const raw = this._doc.searchAllText(
        query,
        o.caseSensitive === true,
        o.includeCells !== false,
      );
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  /**
   * 문서 전체 텍스트를 뽑는다. 검색·공유·접근성용.
   * 렌더 HTML에서 텍스트 노드만 걷는다.
   * @param {object} [opts]
   * @param {number} [opts.maxPages] 앞쪽 몇 쪽만 (기본 전체)
   * @returns {string}
   */
  extractText(opts) {
    const o = opts || {};
    const limit = Math.min(o.maxPages || this.pageCount, this.pageCount);
    const out = [];
    for (let i = 0; i < limit; i++) {
      const html = this._doc.renderPageHtml(i);
      out.push(htmlToText(html));
    }
    return out.join("\n\n");
  }

  _put(key, value) {
    if (this._cache.size >= this._cacheLimit * 2) {
      // 가장 먼저 넣은 것부터 버린다 (삽입 순서 = Map 순서).
      const first = this._cache.keys().next();
      if (!first.done) this._cache.delete(first.value);
    }
    this._cache.set(key, value);
  }

  /** 쪽 정보(크기 px·여백 등). 실패하면 null. */
  pageInfo(pageIndex) {
    try { return JSON.parse(this._doc.getPageInfo(pageIndex)); } catch (_) { return null; }
  }

  /** 쪽 하나의 글. 엔진은 JSON 문자열로 준다. */
  pageText(pageIndex) {
    try {
      const raw = this._doc.getPageText(pageIndex);
      if (typeof raw !== "string") return "";
      try { const v = JSON.parse(raw); return typeof v === "string" ? v : raw; } catch (_) { return raw; }
    } catch (_) { return ""; }
  }

  /** WASM 쪽 메모리를 즉시 놓아준다. 문서를 닫을 때 반드시 부른다. */
  close() {
    this._cache.clear();
    try { this._doc.free(); } catch (_) { /* 이미 해제됐으면 무시 */ }
    this._doc = null;
  }
}

/**
 * 파일 목록용 썸네일. HWP/HWPX 안에 들어 있는 미리보기 이미지를 꺼낸다.
 * 없으면 null. 4.5MB WASM을 이미 올린 뒤에만 의미가 있다.
 * @param {Uint8Array} bytes
 * @returns {Uint8Array|null}
 */
export function extractThumbnail(bytes) {
  if (!wasmExports || typeof wasmExports.extractThumbnail !== "function") return null;
  try {
    const out = wasmExports.extractThumbnail(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    return out && out.length ? out : null;
  } catch (_) {
    return null;
  }
}

/** 렌더 HTML에서 눈에 보이는 텍스트만 뽑는다. */
export function htmlToText(html) {
  const withBreaks = String(html)
    .replace(/<\/(div|p|tr|header|footer|td)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]*>/g, "");
  return stripped
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}
