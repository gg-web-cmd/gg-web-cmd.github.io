/* 서버와 화면이 함께 쓰는 계산식.
 *
 * "몇 번째 쪽이 어떤 파일 이름이 되는가" 와 "얼마나 크게 그릴 것인가" 만 모아 두었다.
 * 여기 있는 함수는 파일도 화면도 건드리지 않는 순수 계산이라,
 * 브라우저 없이 node 만으로 자체 점검(--selftest)을 돌릴 수 있다.
 *
 * 이 파일은 Node 에서는 require 로, 브라우저에서는 <script> 로 읽는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module && module.exports) module.exports = factory();
  else root.Shared = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── 작은 도구 ───────────────────────────────────────────────────── */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /** 윈도우 파일 이름으로 쓸 수 없는 글자를 걷어 낸다 */
  function safeName(s, fallback) {
    var out = String(s == null ? '' : s)
      .replace(/[\\/:*?"<>|]/g, '')      // 윈도우가 금지하는 글자
      .replace(/[\x00-\x1f]/g, '')       // 눈에 안 보이는 제어 글자
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')               // 앞의 점은 숨김 파일이 된다
      .replace(/[. ]+$/, '')             // 끝의 점·빈칸은 윈도우가 멋대로 지운다
      .slice(0, 80)
      .trim();
    /* CON, PRN, LPT1 처럼 윈도우가 장치 이름으로 예약해 둔 말은 그대로 못 쓴다 */
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(out)) out = out + '_';
    return out || (fallback || 'PDF');
  }

  /** PDF 파일 이름에서 확장자만 뗀다 ("보고서.pdf" → "보고서") */
  function stemOf(fileName) {
    var name = String(fileName || '').split(/[\\/]/).pop();
    return name.replace(/\.pdf$/i, '');
  }

  /** 1 → "001" (자릿수가 모자라면 늘어난다: 1234 → "1234") */
  function pad(n, digits) {
    var s = String(Math.max(0, Math.round(n)));
    while (s.length < digits) s = '0' + s;
    return s;
  }

  /**
   * 몇 자리로 번호를 매길지.
   *
   * 자동이면 마지막 쪽 번호가 다 들어가는 자릿수로 하되 최소 세 자리(001)를 쓴다.
   * 이렇게 해야 탐색기에서 이름순으로 늘어놓았을 때 PDF 쪽 순서와 똑같아진다.
   * (한 자리로 매기면 10쪽 뒤부터 1, 10, 11, 2 … 로 뒤섞인다)
   */
  function digitsFor(total, start, want) {
    var last = Math.max(1, (Number(start) || 1) + (Number(total) || 1) - 1);
    var need = String(last).length;
    if (want === 'auto' || !want) return Math.max(3, need);
    return Math.max(Number(want) || 3, need);
  }

  var SEPS = { under: '_', dash: '-', space: ' ', none: '' };

  /** 이름 사이에 넣을 글자 ('under' → '_') */
  function sepChar(key) {
    return Object.prototype.hasOwnProperty.call(SEPS, key) ? SEPS[key] : '_';
  }

  /**
   * 쪽 하나의 파일 이름.
   *
   *   opt = {base:'보고서', sep:'under', start:1, digits:'auto',
   *          total:12, ext:'jpg', omitWhenSingle:true}
   *   pageNo 는 1부터 세는 PDF 쪽 번호.
   *
   * 파일 이름의 번호는 PDF 쪽 순서 그대로다 — 1쪽이 001, 2쪽이 002.
   * (start 를 바꾸면 시작 번호만 옮겨지고 순서는 그대로다)
   */
  function pageName(pageNo, opt) {
    var o = opt || {};
    var base = safeName(o.base, 'PDF');
    var total = Math.max(1, Number(o.total) || 1);
    var start = Number(o.start);
    if (!isFinite(start)) start = 1;
    var ext = String(o.ext || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';

    if (o.omitWhenSingle && total === 1) return base + '.' + ext;

    var digits = digitsFor(total, start, o.digits);
    var num = pad(start + (Math.max(1, Number(pageNo) || 1) - 1), digits);
    return base + sepChar(o.sep) + num + '.' + ext;
  }

  /** 1쪽부터 total 쪽까지의 이름을 쪽 순서대로 (미리 보여 주거나 겹침을 확인할 때) */
  function planNames(opt) {
    var total = Math.max(1, Number(opt && opt.total) || 1);
    var out = [];
    for (var i = 1; i <= total; i++) out.push(pageName(i, opt));
    return out;
  }

  /** 이름이 겹칠 때 "보고서_001.jpg" → "보고서_001-2.jpg" */
  function bumpName(name, n) {
    var dot = name.lastIndexOf('.');
    if (dot <= 0) return name + '-' + n;
    return name.slice(0, dot) + '-' + n + name.slice(dot);
  }

  /* ── 얼마나 크게 그릴 것인가 ─────────────────────────────────────── */

  /* 브라우저가 한 번에 다룰 수 있는 그림 크기에는 한계가 있다.
   * 넘어서면 조용히 빈 그림이 나오므로, 넘기 전에 우리가 먼저 줄인다. */
  var MAX_SIDE = 16384;          // 한 변
  var MAX_PIXELS = 80e6;         // 넓이 (80메가픽셀 ≈ 320MB 메모리)

  /**
   * PDF 쪽 크기(72dpi 기준 pt)를 받아 실제로 그릴 픽셀 크기를 정한다.
   *
   *   size = {mode:'dpi', dpi:200}      종이에 인쇄한 것과 같은 해상도로
   *   size = {mode:'long', px:2000}     긴 쪽을 2000픽셀로 (쪽마다 크기가 달라도 고르게)
   *
   * 돌려주는 값의 scale 을 pdf.js viewport 에 그대로 넘기면 된다.
   * limited 가 true 면 너무 커서 우리가 줄인 것이다.
   */
  function renderSize(ptW, ptH, size) {
    var w = Math.max(1, Number(ptW) || 612);
    var h = Math.max(1, Number(ptH) || 792);
    var s = size || {};
    var scale;

    if (s.mode === 'long') {
      var px = clamp(Number(s.px) || 2000, 200, MAX_SIDE);
      scale = px / Math.max(w, h);
    } else {
      var dpi = clamp(Number(s.dpi) || 200, 36, 1200);
      scale = dpi / 72;
    }

    var limited = false;
    var side = Math.max(w, h) * scale;
    if (side > MAX_SIDE) { scale *= MAX_SIDE / side; limited = true; }
    var area = w * scale * h * scale;
    if (area > MAX_PIXELS) { scale *= Math.sqrt(MAX_PIXELS / area); limited = true; }

    var outW = Math.max(1, Math.floor(w * scale));
    var outH = Math.max(1, Math.floor(h * scale));
    return {
      scale: scale,
      width: outW,
      height: outH,
      dpi: Math.round(scale * 72),
      pixels: outW * outH,
      limited: limited,
    };
  }

  /** 품질 이름 → JPEG 품질 값 */
  var QUALITY = { low: 0.7, mid: 0.82, high: 0.9, best: 0.96 };
  function qualityOf(key) {
    return QUALITY[key] != null ? QUALITY[key] : QUALITY.high;
  }

  /** 만들어질 파일 크기 어림잡기 (픽셀당 바이트, 아주 거친 값) */
  function guessBytes(pixels, qualityKey) {
    var bpp = { low: 0.12, mid: 0.2, high: 0.3, best: 0.55 }[qualityKey] || 0.3;
    return Math.round(pixels * bpp);
  }

  /* ── 보기 좋게 ───────────────────────────────────────────────────── */

  function fmtBytes(n) {
    var b = Number(n) || 0;
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + ' MB';
    return (b / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  function fmtDuration(ms) {
    var s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    var m = Math.floor(s / 60);
    var r = s % 60;
    if (m <= 0) return r + '초';
    return m + '분 ' + r + '초';
  }

  /**
   * "1-3, 7, 10-" 같은 쪽 범위를 실제 쪽 번호 목록으로.
   * 비어 있으면 전체. 순서는 언제나 PDF 쪽 순서대로 정리해서 돌려준다.
   */
  function parseRange(text, total) {
    var all = [];
    for (var i = 1; i <= total; i++) all.push(i);
    var t = String(text || '').trim();
    if (!t) return all;

    var picked = {};
    var parts = t.split(/[,،\s]+/).filter(Boolean);
    var any = false;
    for (var p = 0; p < parts.length; p++) {
      var m = /^(\d*)\s*(?:[-~–]\s*(\d*))?$/.exec(parts[p]);
      if (!m) continue;
      var hasDash = /[-~–]/.test(parts[p]);
      var a = m[1] ? parseInt(m[1], 10) : 1;
      var b = hasDash ? (m[2] ? parseInt(m[2], 10) : total) : a;
      if (!isFinite(a) || !isFinite(b)) continue;
      if (a > b) { var tmp = a; a = b; b = tmp; }
      /* 아예 바깥에 있는 쪽(10쪽짜리에 "99")은 잘라 붙이지 않고 없던 일로 한다.
       * 그대로 끝 쪽으로 붙여 버리면 사용자가 오타를 알아채지 못한다. */
      if (b < 1 || a > total) continue;
      a = clamp(a, 1, total); b = clamp(b, 1, total);
      for (var n = a; n <= b; n++) { picked[n] = true; any = true; }
    }
    if (!any) return all;
    return all.filter(function (n) { return picked[n]; });
  }

  return {
    clamp: clamp,
    safeName: safeName,
    stemOf: stemOf,
    pad: pad,
    digitsFor: digitsFor,
    sepChar: sepChar,
    SEPS: SEPS,
    pageName: pageName,
    planNames: planNames,
    bumpName: bumpName,
    renderSize: renderSize,
    qualityOf: qualityOf,
    guessBytes: guessBytes,
    fmtBytes: fmtBytes,
    fmtDuration: fmtDuration,
    parseRange: parseRange,
    MAX_SIDE: MAX_SIDE,
    MAX_PIXELS: MAX_PIXELS,
  };
}));
