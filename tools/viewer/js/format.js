/**
 * 문서 포맷 판별기 (확장자를 신뢰하지 않는다).
 *
 * ZIP 계열(hwpx/docx/xlsx/pptx/odf/epub/iWork)은 전부 시그니처가 PK 03 04 이고,
 * CFB 계열(hwp/doc/xls/ppt)은 전부 D0 CF 11 E0 이다. 그래서 컨테이너를 열어
 * 내부 엔트리 이름을 봐야 실제 포맷이 갈린다.
 * iOS 쪽 Swift 판별기와 판단 순서를 동일하게 맞춘다.
 * → ios/DocsViewer/Routing/DocumentClassifier.swift
 */

export const Kind = Object.freeze({
  PDF: "pdf",
  HWP: "hwp",
  HWP3: "hwp3",
  HWPX: "hwpx",
  DOC: "doc", DOCX: "docx",
  XLS: "xls", XLSX: "xlsx",
  PPT: "ppt", PPTX: "pptx",
  RTF: "rtf",
  ODT: "odt", ODS: "ods", ODP: "odp",
  EPUB: "epub",
  PAGES: "pages", NUMBERS: "numbers", KEYNOTE: "keynote",
  IMAGE: "image",
  TEXT: "text",
  CSV: "csv",
  ZIP: "zip",
  CFB: "cfb",
  UNKNOWN: "unknown",
});

/** 렌더러 배정표. iOS 앱과 웹 뷰어가 같은 표를 공유한다. */
export const RENDERER = Object.freeze({
  [Kind.PDF]:     { ios: "pdfkit",    web: "pdfjs" },
  [Kind.HWP]:     { ios: "hwp-wasm",  web: "hwp-wasm" },
  [Kind.HWPX]:    { ios: "hwp-wasm",  web: "hwp-wasm" },
  [Kind.HWP3]:    { ios: "hwp-wasm",  web: "hwp-wasm" },
  [Kind.DOC]:     { ios: "quicklook", web: "none" },
  [Kind.DOCX]:    { ios: "quicklook", web: "none" },
  [Kind.XLS]:     { ios: "quicklook", web: "none" },
  [Kind.XLSX]:    { ios: "quicklook", web: "none" },
  [Kind.PPT]:     { ios: "quicklook", web: "none" },
  [Kind.PPTX]:    { ios: "quicklook", web: "none" },
  [Kind.RTF]:     { ios: "quicklook", web: "none" },
  [Kind.ODT]:     { ios: "quicklook", web: "none" },
  [Kind.ODS]:     { ios: "quicklook", web: "none" },
  [Kind.ODP]:     { ios: "quicklook", web: "none" },
  [Kind.EPUB]:    { ios: "quicklook", web: "none" },
  [Kind.PAGES]:   { ios: "quicklook", web: "none" },
  [Kind.NUMBERS]: { ios: "quicklook", web: "none" },
  [Kind.KEYNOTE]: { ios: "quicklook", web: "none" },
  [Kind.IMAGE]:   { ios: "native",    web: "img" },
  [Kind.TEXT]:    { ios: "text",      web: "text" },
  [Kind.CSV]:     { ios: "text",      web: "text" },
  [Kind.ZIP]:     { ios: "quicklook", web: "none" },
  [Kind.CFB]:     { ios: "quicklook", web: "none" },
  [Kind.UNKNOWN]: { ios: "quicklook", web: "none" },
});

const td = new TextDecoder("utf-8", { fatal: false });
const u8 = (b) => (b instanceof Uint8Array ? b : new Uint8Array(b));

function startsWith(buf, bytes, at) {
  const off = at || 0;
  if (buf.length < off + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) if (buf[off + i] !== bytes[i]) return false;
  return true;
}

/** 문자열을 바이트 배열로. 시그니처 비교용. */
function ascii(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
  return out;
}

/* ------------------------------------------------------------------ ZIP */

/**
 * ZIP 중앙 디렉터리에서 엔트리 이름 목록을 뽑는다. 압축 해제는 하지 않는다.
 * mimetype (HWPX/ODF/EPUB에서 항상 무압축 첫 엔트리)은 값까지 읽어 준다.
 */
export function readZipEntries(buf, opts) {
  const maxEntries = (opts && opts.maxEntries) || 4096;
  const b = u8(buf);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const names = [];
  let mimetype = null;

  // 규격을 지킨 HWPX/EPUB/ODF는 mimetype이 무압축 첫 엔트리라서
  // EOCD 없이도 로컬 헤더에서 바로 읽힌다.
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) && b.length > 30) {
    const nameLen = dv.getUint16(26, true);
    const extraLen = dv.getUint16(28, true);
    const method = dv.getUint16(8, true);
    const name = td.decode(b.subarray(30, 30 + nameLen));
    if (name === "mimetype" && method === 0) {
      const size = dv.getUint32(18, true);
      const start = 30 + nameLen + extraLen;
      mimetype = td.decode(b.subarray(start, start + Math.min(size, 200))).trim();
    }
  }

  // EOCD를 뒤에서 찾는다 (주석 최대 65535 + EOCD 22).
  const scanFrom = Math.max(0, b.length - 66000);
  let eocd = -1;
  for (let i = b.length - 22; i >= scanFrom; i--) {
    if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
  }

  if (eocd >= 0) {
    const count = dv.getUint16(eocd + 10, true);
    const cdOff = dv.getUint32(eocd + 16, true);
    // ZIP64 자리표시자(0xffffffff)면 중앙 디렉터리 위치를 못 믿으므로 건너뛴다.
    if (cdOff !== 0xffffffff && cdOff < b.length) {
      let p = cdOff;
      const limit = count === 0xffff ? maxEntries : Math.min(count, maxEntries);
      for (let i = 0; i < limit && p + 46 <= b.length; i++) {
        if (!(b[p] === 0x50 && b[p + 1] === 0x4b && b[p + 2] === 0x01 && b[p + 3] === 0x02)) break;
        const nLen = dv.getUint16(p + 28, true);
        const eLen = dv.getUint16(p + 30, true);
        const cLen = dv.getUint16(p + 32, true);
        const name = td.decode(b.subarray(p + 46, p + 46 + nLen));
        names.push(name);
        // mimetype이 첫 엔트리가 아닌 파일도 실제로 유통된다(한컴/공문 생성기 등).
        // 무압축이면 로컬 헤더에서 값을 읽어 준다. 압축돼 있으면 여기서는 포기하고
        // 구조 기반 판별(content.xml 등)로 넘긴다.
        if (mimetype === null && name === "mimetype") {
          const lho = dv.getUint32(p + 42, true);
          if (lho + 30 <= b.length) {
            const lMethod = dv.getUint16(lho + 8, true);
            const lnLen = dv.getUint16(lho + 26, true);
            const leLen = dv.getUint16(lho + 28, true);
            const size = dv.getUint32(lho + 18, true) || dv.getUint32(p + 20, true);
            const start = lho + 30 + lnLen + leLen;
            if (lMethod === 0 && start + size <= b.length && size < 200) {
              mimetype = td.decode(b.subarray(start, start + size)).trim();
            }
          }
        }
        p += 46 + nLen + eLen + cLen;
      }
    }
  }

  if (names.length === 0) {
    // 중앙 디렉터리를 못 읽었으면 로컬 헤더를 순차 스캔한다 (손상 파일 대비).
    let p = 0, guard = 0;
    while (p + 30 <= b.length && guard++ < maxEntries) {
      if (!(b[p] === 0x50 && b[p + 1] === 0x4b && b[p + 2] === 0x03 && b[p + 3] === 0x04)) break;
      const nLen = dv.getUint16(p + 26, true);
      const eLen = dv.getUint16(p + 28, true);
      const cSize = dv.getUint32(p + 18, true);
      names.push(td.decode(b.subarray(p + 30, p + 30 + nLen)));
      if (cSize === 0) break; // data descriptor 방식 → 순차 스캔 불가
      p += 30 + nLen + eLen + cSize;
    }
  }

  return { names: names, mimetype: mimetype };
}

function classifyZip(buf, extHint) {
  const res = readZipEntries(buf);
  const names = res.names;
  const mimetype = res.mimetype;
  const has = (p) => names.indexOf(p) >= 0;
  const under = (p) => names.some((n) => n.indexOf(p) === 0);

  // 엔트리를 하나도 못 읽었다 = 잘리거나 손상된 컨테이너.
  // ZIP이라고 단정하지 말고 호출부가 확장자를 믿도록 null을 준다.
  if (names.length === 0 && !mimetype) return null;

  if (mimetype) {
    const m = mimetype.toLowerCase();
    if (m.indexOf("hwp") >= 0) return Kind.HWPX;
    if (m === "application/epub+zip") return Kind.EPUB;
    if (m === "application/vnd.oasis.opendocument.text") return Kind.ODT;
    if (m === "application/vnd.oasis.opendocument.spreadsheet") return Kind.ODS;
    if (m === "application/vnd.oasis.opendocument.presentation") return Kind.ODP;
  }
  if (has("Contents/content.hpf") || under("Contents/section")) return Kind.HWPX;
  if (under("word/")) return Kind.DOCX;
  if (under("xl/")) return Kind.XLSX;
  if (under("ppt/")) return Kind.PPTX;
  if (under("Index/") && names.some((n) => /\.iwa$/.test(n))) {
    if (names.some((n) => /Document\.iwa$/.test(n))) return Kind.PAGES;
    if (names.some((n) => /Tables|Calculation/.test(n))) return Kind.NUMBERS;
    return Kind.KEYNOTE;
  }
  if (has("index.apxl") || has("index.apxl.gz")) return Kind.KEYNOTE;
  if (has("META-INF/container.xml")) return Kind.EPUB;

  // ODF 구조 판별. mimetype을 압축해서 넣거나 첫 엔트리로 두지 않은 파일이
  // 실제로 유통된다(교육청 공문 .odt 다수). 그 경우 여기로 떨어진다.
  // 세 하위 포맷은 iOS에서 모두 QuickLook으로 가므로 확장자 힌트로 충분하다.
  if (has("content.xml") && has("META-INF/manifest.xml")) {
    if (extHint === "ods") return Kind.ODS;
    if (extHint === "odp") return Kind.ODP;
    return Kind.ODT;
  }
  return Kind.ZIP;
}

/* ------------------------------------------------------------------ CFB */

/**
 * CFB(OLE2) 디렉터리 엔트리 이름을 읽는다. hwp/doc/xls/ppt 구분에 필요하다.
 * 분류 목적이므로 앞쪽 디렉터리 섹터만 훑고, 실패하면 빈 배열을 준다.
 */
export function readCfbEntryNames(buf, opts) {
  const maxSectors = (opts && opts.maxSectors) || 32;
  const b = u8(buf);
  if (b.length < 512) return [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const sectorShift = dv.getUint16(30, true);
  const sectorSize = 1 << sectorShift;
  if (sectorSize !== 512 && sectorSize !== 4096) return [];
  const firstDirSector = dv.getUint32(48, true);
  const offOf = (sec) => (sec + 1) * sectorSize;

  // DIFAT 앞부분(109개)만 써서 FAT을 구성한다. 분류에는 충분하다.
  const fat = [];
  for (let i = 0; i < 109; i++) {
    const fatSec = dv.getUint32(76 + i * 4, true);
    if (fatSec === 0xffffffff) break;
    const o = offOf(fatSec);
    if (o + sectorSize > b.length) break;
    for (let j = 0; j < sectorSize / 4; j++) fat.push(dv.getUint32(o + j * 4, true));
  }

  const names = [];
  let sec = firstDirSector;
  let guard = 0;
  const seen = new Set();
  while (sec !== 0xffffffff && sec !== 0xfffffffe && guard++ < maxSectors && !seen.has(sec)) {
    seen.add(sec);
    const o = offOf(sec);
    if (o + sectorSize > b.length) break;
    for (let e = 0; e + 128 <= sectorSize; e += 128) {
      const p = o + e;
      const nameLen = dv.getUint16(p + 64, true); // 널 종료 포함 바이트 수
      const objType = b[p + 66];                  // 0 empty, 1 storage, 2 stream, 5 root
      if (objType === 0 || nameLen < 2 || nameLen > 64) continue;
      let s = "";
      for (let i = 0; i + 1 < nameLen; i += 2) {
        const c = dv.getUint16(p + i, true);
        if (c === 0) break;
        s += String.fromCharCode(c);
      }
      if (s) names.push(s);
    }
    sec = sec < fat.length ? fat[sec] : 0xffffffff;
  }
  return names;
}

function classifyCfb(buf) {
  const names = readCfbEntryNames(buf);
  const has = (n) => names.indexOf(n) >= 0;
  // HWP 5.x: FileHeader 스트림 + DocInfo/HwpSummaryInformation
  if (has("FileHeader") && (has("DocInfo") || has("HwpSummaryInformation"))) return Kind.HWP;
  if (has("WordDocument")) return Kind.DOC;
  if (has("Workbook") || has("Book")) return Kind.XLS;
  if (has("PowerPoint Document")) return Kind.PPT;

  // 디렉터리 파싱이 실패했으면 원시 바이트에서 UTF-16LE 이름을 찾아 본다.
  const head = u8(buf).subarray(0, Math.min(buf.length, 1 << 16));
  const find = (s) => {
    const pat = [];
    for (let i = 0; i < s.length; i++) { pat.push(s.charCodeAt(i) & 0xff, s.charCodeAt(i) >> 8); }
    for (let i = 0; i + pat.length <= head.length; i++) if (startsWith(head, pat, i)) return true;
    return false;
  };
  if (find("FileHeader")) return Kind.HWP;
  if (find("WordDocument")) return Kind.DOC;
  if (find("Workbook")) return Kind.XLS;
  if (find("PowerPoint Document")) return Kind.PPT;
  // 알려진 스트림이 없다 = 잘렸거나 우리가 모르는 OLE 문서.
  // 호출부가 확장자를 믿도록 null을 준다.
  return null;
}

/* ------------------------------------------------------------------ 본체 */

const IMAGE_SIGS = [
  [0x89, 0x50, 0x4e, 0x47],             // PNG
  [0xff, 0xd8, 0xff],                   // JPEG
  [0x47, 0x49, 0x46, 0x38],             // GIF8
  [0x42, 0x4d],                         // BMP
  [0x49, 0x49, 0x2a, 0x00],             // TIFF LE
  [0x4d, 0x4d, 0x00, 0x2a],             // TIFF BE
];

/** 확장자 → 포맷. 바이트로 결론이 안 날 때만 쓰는 폴백. */
export const EXT_KIND = Object.freeze({
  pdf: Kind.PDF,
  hwp: Kind.HWP, hwpx: Kind.HWPX,
  doc: Kind.DOC, docx: Kind.DOCX, docm: Kind.DOCX, dotx: Kind.DOCX,
  xls: Kind.XLS, xlsx: Kind.XLSX, xlsm: Kind.XLSX, xltx: Kind.XLSX,
  ppt: Kind.PPT, pptx: Kind.PPTX, pptm: Kind.PPTX, potx: Kind.PPTX,
  rtf: Kind.RTF, rtfd: Kind.RTF,
  odt: Kind.ODT, ods: Kind.ODS, odp: Kind.ODP,
  epub: Kind.EPUB,
  pages: Kind.PAGES, numbers: Kind.NUMBERS, key: Kind.KEYNOTE,
  png: Kind.IMAGE, jpg: Kind.IMAGE, jpeg: Kind.IMAGE, gif: Kind.IMAGE,
  bmp: Kind.IMAGE, tif: Kind.IMAGE, tiff: Kind.IMAGE, webp: Kind.IMAGE,
  heic: Kind.IMAGE, heif: Kind.IMAGE, avif: Kind.IMAGE, svg: Kind.IMAGE,
  csv: Kind.CSV, tsv: Kind.CSV,
  zip: Kind.ZIP,
});

/** 바이트로 결론이 안 났을 때 확장자를 믿어도 되는 포맷(= 전용 뷰어가 있는 것). */
const EXT_TRUSTWORTHY = new Set([
  Kind.PDF, Kind.HWP, Kind.HWPX, Kind.DOC, Kind.DOCX, Kind.XLS, Kind.XLSX,
  Kind.PPT, Kind.PPTX, Kind.RTF, Kind.ODT, Kind.ODS, Kind.ODP, Kind.EPUB,
  Kind.PAGES, Kind.NUMBERS, Kind.KEYNOTE,
]);

/**
 * 바이트로 포맷을 판별한다. 확장자는 바이트로 결론이 안 날 때만 쓴다.
 *
 * confidence:
 *   "high"  — 시그니처와 컨테이너 내부까지 확인함
 *   "low"   — 시그니처가 불명확해서 확장자를 믿었음 (손상 파일일 수 있음)
 *
 * @param {Uint8Array|ArrayBuffer} buf 파일 앞부분(최소 512B, ZIP이면 뒤쪽 EOCD까지)
 * @param {string} [filename]
 * @returns {{kind: string, ext: string, reason: string, confidence: string}}
 */
export function classify(buf, filename) {
  const b = u8(buf);
  const name = filename || "";
  const m = name.match(/\.([A-Za-z0-9]+)$/);
  const ext = m ? m[1].toLowerCase() : "";
  const hi = (kind, reason) => ({ kind: kind, ext: ext, reason: reason, confidence: "high" });

  if (b.length === 0) return { kind: Kind.UNKNOWN, ext: ext, reason: "빈 파일", confidence: "high" };

  if (startsWith(b, ascii("%PDF-"))) return hi(Kind.PDF, "%PDF- 시그니처");

  const isCfb = startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (isCfb) {
    const cfbKind = classifyCfb(b);
    if (cfbKind) return hi(cfbKind, "CFB 디렉터리 엔트리");
  }
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) {
    const zipKind = classifyZip(b, ext);
    // null 이면 컨테이너가 손상된 것이다. 아래 확장자 폴백으로 내려보낸다.
    if (zipKind) return hi(zipKind, "ZIP 엔트리 목록");
  }
  if (startsWith(b, ascii("HWP Document File V3.00"))) return hi(Kind.HWP3, "HWP 3.0 시그니처");
  if (startsWith(b, ascii("{\\rtf"))) return hi(Kind.RTF, "RTF 시그니처");

  for (let i = 0; i < IMAGE_SIGS.length; i++) {
    if (startsWith(b, IMAGE_SIGS[i])) return hi(Kind.IMAGE, "이미지 시그니처");
  }
  // ISO-BMFF: HEIC/HEIF/AVIF
  if (startsWith(b, ascii("ftyp"), 4)) {
    const brand = td.decode(b.subarray(8, 12));
    if (/heic|heix|hevc|hevx|mif1|msf1|avif/i.test(brand)) return hi(Kind.IMAGE, "ISO-BMFF " + brand);
  }
  if (startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8)) return hi(Kind.IMAGE, "WEBP");

  // 여기까지 왔으면 시그니처로는 결론이 안 났다.
  // 확장자가 전용 뷰어가 있는 포맷을 가리키면 그쪽을 믿는다. 손상 파일이라도
  // "텍스트로 열어 깨진 글자 보여주기"보다 "한글 문서 열기 실패"가 낫다.
  const byExt = EXT_KIND[ext];
  if (byExt && EXT_TRUSTWORTHY.has(byExt)) {
    return { kind: byExt, ext: ext, reason: "시그니처 불일치, 확장자 신뢰", confidence: "low" };
  }
  if (looksLikeText(b)) {
    const kind = ext === "csv" || ext === "tsv" ? Kind.CSV : Kind.TEXT;
    return hi(kind, "텍스트 추정");
  }
  if (byExt) return { kind: byExt, ext: ext, reason: "시그니처 불일치, 확장자 신뢰", confidence: "low" };
  // 컨테이너 종류는 알지만 내용을 못 알아본 경우. QuickLook에 맡기는 게 낫다.
  if (isCfb) return { kind: Kind.CFB, ext: ext, reason: "알 수 없는 OLE 복합 문서", confidence: "high" };
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) {
    return { kind: Kind.ZIP, ext: ext, reason: "알 수 없는 ZIP 컨테이너", confidence: "high" };
  }
  return { kind: Kind.UNKNOWN, ext: ext, reason: "시그니처 불일치", confidence: "high" };
}

/** 앞 8KB의 NUL/제어문자 비율로 텍스트인지 본다. */
export function looksLikeText(buf) {
  const b = u8(buf);
  if (startsWith(b, [0xef, 0xbb, 0xbf])) return true;
  if (startsWith(b, [0xff, 0xfe]) || startsWith(b, [0xfe, 0xff])) return true;
  const n = Math.min(b.length, 8192);
  let ctrl = 0, nul = 0;
  for (let i = 0; i < n; i++) {
    const c = b[i];
    if (c === 0) nul++;
    else if (c < 0x09 || (c > 0x0d && c < 0x20)) ctrl++;
  }
  if (nul > 0) return false;
  return ctrl / n < 0.02;
}

/** 사람이 읽을 포맷 이름. */
export const KIND_LABEL = Object.freeze({
  pdf: "PDF", hwp: "한글 HWP", hwp3: "한글 HWP 3.0", hwpx: "한글 HWPX",
  doc: "Word 97-2003", docx: "Word", xls: "Excel 97-2003", xlsx: "Excel",
  ppt: "PowerPoint 97-2003", pptx: "PowerPoint", rtf: "서식 있는 텍스트",
  odt: "ODF 문서", ods: "ODF 스프레드시트", odp: "ODF 프레젠테이션",
  epub: "EPUB 전자책", pages: "Pages", numbers: "Numbers", keynote: "Keynote",
  image: "이미지", text: "텍스트", csv: "CSV 표", zip: "압축 파일",
  cfb: "OLE 복합 문서", unknown: "알 수 없음",
});
