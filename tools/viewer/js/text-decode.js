/**
 * 텍스트 파일 인코딩 감지 + 디코딩.
 *
 * 한국에서 도는 .txt/.csv/.srt/소스코드 파일은 UTF-8 아니면 CP949(EUC-KR 확장)다.
 * CP949 파일을 UTF-8로 읽으면 전부 물음표가 되므로 감지가 필수다.
 *
 * ── 환경별 주의 ──────────────────────────────────────────────────────────
 * TextDecoder('euc-kr')의 동작이 환경마다 다르다.
 *  - 브라우저(WebKit/Blink): WHATWG Encoding 규격을 따라 CP949(UHC) 확장 영역
 *    (뒷바이트 0x41~0xA0)까지 해독한다.
 *  - Node: ICU의 엄격한 EUC-KR 변환기라서 확장 영역을 못 읽고 U+FFFD를 낸다.
 *    (검증: 0x81 0x41 → 브라우저 U+AC02 / Node U+0081+U+0041)
 * 따라서 Node 테스트에서 확장 영역 글자가 깨지는 것은 이 코드의 버그가 아니다.
 * iOS 네이티브 텍스트 뷰어는 이 경로를 쓰지 않고 CP949 변환기를 직접 쓴다.
 *   → ios/DocsViewer/Viewers/TextDocumentLoader.swift
 * ─────────────────────────────────────────────────────────────────────────
 */

/** 시도해 볼 인코딩. 앞쪽이 우선. */
const CANDIDATES = ["utf-8", "euc-kr", "utf-16le", "utf-16be", "shift_jis", "gb18030", "big5"];

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/g;
const CJK = /[㐀-䶿一-鿿豈-﫿]/g;
const KANA = /[぀-ヿ]/g;

/**
 * BOM을 보고 인코딩을 확정한다.
 * @returns {{encoding: string, bomLength: number}|null}
 */
export function detectBom(bytes) {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return { encoding: "utf-8", bomLength: 3 };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xfe && b[2] === 0x00 && b[3] === 0x00) return { encoding: "utf-32le", bomLength: 4 };
  if (b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0xfe && b[3] === 0xff) return { encoding: "utf-32be", bomLength: 4 };
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return { encoding: "utf-16le", bomLength: 2 };
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return { encoding: "utf-16be", bomLength: 2 };
  return null;
}

/** 바이트열이 올바른 UTF-8인지 직접 검사한다 (TextDecoder fatal보다 이유를 알기 쉽다). */
export function isValidUtf8(bytes) {
  let i = 0;
  const n = bytes.length;
  let sawMultibyte = false;
  while (i < n) {
    const c = bytes[i];
    if (c < 0x80) { i++; continue; }
    let need, min, cp;
    if (c >= 0xc2 && c <= 0xdf) { need = 1; min = 0x80; cp = c & 0x1f; }
    else if (c >= 0xe0 && c <= 0xef) { need = 2; min = 0x800; cp = c & 0x0f; }
    else if (c >= 0xf0 && c <= 0xf4) { need = 3; min = 0x10000; cp = c & 0x07; }
    else return { valid: false, sawMultibyte, at: i };
    if (i + need >= n) {
      // 표본 끝에서 문자가 잘렸다. 앞부분만 읽었을 때 흔한 일이라 실패로 보지 않는다.
      return { valid: true, sawMultibyte, truncated: true };
    }
    for (let k = 1; k <= need; k++) {
      const cc = bytes[i + k];
      if (cc < 0x80 || cc > 0xbf) return { valid: false, sawMultibyte, at: i };
      cp = (cp << 6) | (cc & 0x3f);
    }
    if (cp < min) return { valid: false, sawMultibyte, at: i };           // 과잉 인코딩
    if (cp >= 0xd800 && cp <= 0xdfff) return { valid: false, sawMultibyte, at: i }; // 서러게이트
    if (cp > 0x10ffff) return { valid: false, sawMultibyte, at: i };
    sawMultibyte = true;
    i += need + 1;
  }
  return { valid: true, sawMultibyte };
}

/**
 * BOM 없는 UTF-16 빠른 판정: NUL 바이트가 홀/짝 한쪽에만 몰려 있는지 본다.
 *
 * 라틴 문자 위주 문서에서만 통한다. 한글·한자는 두 바이트가 모두 0이 아니라
 * (예: 나 = U+B098 → 98 B0) NUL이 아예 안 생기므로 이 방법으로는 못 잡는다.
 * 그래서 여기서 null이 나와도 끝이 아니고, 아래 점수 경쟁에 utf-16을 함께 올린다.
 */
function looksLikeUtf16(bytes) {
  const n = Math.min(bytes.length, 4096);
  if (n < 4) return null;
  let evenNul = 0, oddNul = 0;
  for (let i = 0; i < n; i++) {
    if (bytes[i] === 0) { if (i % 2 === 0) evenNul++; else oddNul++; }
  }
  const half = n / 2;
  if (oddNul > half * 0.3 && evenNul < half * 0.05) return "utf-16le";
  if (evenNul > half * 0.3 && oddNul < half * 0.05) return "utf-16be";
  return null;
}

/** 디코딩 결과의 그럴듯함을 점수로 만든다. 높을수록 좋다. */
function score(text, encoding) {
  if (!text) return -Infinity;
  const n = text.length;
  if (n === 0) return -Infinity;
  const bad = (text.match(/�/g) || []).length;
  const hangul = (text.match(HANGUL) || []).length;
  const cjk = (text.match(CJK) || []).length;
  const kana = (text.match(KANA) || []).length;
  // 제어문자(탭/개행 제외)는 잘못된 인코딩의 강한 신호다.
  let ctrl = 0;
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) ctrl++;
  }
  let s = 0;
  s -= (bad / n) * 800;
  s -= (ctrl / n) * 1200;
  s += (hangul / n) * 100;          // 한국어 문서를 우선한다
  s += (cjk / n) * 20;
  s += (kana / n) * 30;
  if (encoding === "utf-8") s += 5; // 동점이면 UTF-8
  return s;
}

/**
 * 인코딩을 감지해서 문자열로 만든다.
 * @param {Uint8Array|ArrayBuffer} buf
 * @param {object} [opts]
 * @param {number} [opts.sampleBytes=65536] 감지에 쓸 앞부분 크기
 * @returns {{text: string, encoding: string, confidence: string, hadBom: boolean,
 *            candidates: Array<{encoding: string, score: number}>}}
 */
export function decodeText(buf, opts) {
  const o = opts || {};
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const sampleSize = o.sampleBytes || 65536;

  const bom = detectBom(bytes);
  if (bom) {
    const body = bytes.subarray(bom.bomLength);
    return {
      text: safeDecode(body, bom.encoding),
      encoding: bom.encoding,
      confidence: "high",
      hadBom: true,
      candidates: [{ encoding: bom.encoding, score: Infinity }],
    };
  }

  const u16 = looksLikeUtf16(bytes);
  if (u16) {
    return {
      text: safeDecode(bytes, u16),
      encoding: u16,
      confidence: "medium",
      hadBom: false,
      candidates: [{ encoding: u16, score: Infinity }],
    };
  }

  const sample = bytes.subarray(0, Math.min(bytes.length, sampleSize));
  const utf8 = isValidUtf8(sample);
  if (utf8.valid) {
    // 다중바이트가 하나도 없으면 순수 ASCII다. 어떤 인코딩으로 읽어도 결과가
    // 같으므로 UTF-8로 확정해도 안전하다.
    return {
      text: safeDecode(bytes, "utf-8"),
      encoding: utf8.sawMultibyte ? "utf-8" : "us-ascii",
      confidence: "high",
      hadBom: false,
      candidates: [{ encoding: "utf-8", score: Infinity }],
    };
  }

  // UTF-8이 아니다 → 레거시 다중바이트이거나 BOM 없는 UTF-16.
  // 후보를 다 디코딩해서 점수를 비교한다. UTF-16은 바이트 수가 짝수일 때만 후보다.
  const evenLength = bytes.length % 2 === 0;
  const scored = [];
  for (const enc of CANDIDATES) {
    if (enc === "utf-8") continue;
    if (enc.startsWith("utf-16") && !evenLength) continue;
    const text = safeDecode(sample, enc);
    scored.push({ encoding: enc, score: score(text, enc) });
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || { encoding: "euc-kr", score: 0 };
  const runnerUp = scored[1];
  const clear = !runnerUp || best.score - runnerUp.score > 5;

  return {
    text: safeDecode(bytes, best.encoding),
    encoding: best.encoding,
    confidence: clear ? "medium" : "low",
    hadBom: false,
    candidates: scored,
  };
}

/** TextDecoder가 라벨을 모르면 UTF-8로 물러난다. */
function safeDecode(bytes, encoding) {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch (_) {
    try { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
    catch (__) { return ""; }
  }
}

/** 사람이 읽을 인코딩 이름. */
export const ENCODING_LABEL = Object.freeze({
  "utf-8": "UTF-8",
  "us-ascii": "ASCII",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
  "utf-32le": "UTF-32 LE",
  "utf-32be": "UTF-32 BE",
  "euc-kr": "CP949 / EUC-KR (한글 완성형)",
  "shift_jis": "Shift_JIS (일본어)",
  "gb18030": "GB18030 (중국어 간체)",
  "big5": "Big5 (중국어 번체)",
});
