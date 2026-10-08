/* 서버와 화면이 함께 쓰는 계산식.
 *
 * 영역 좌표 다듬기·화질(비트레이트) 정하기·파일 이름 짓기·"영상 있는 곳 자동으로 찾기"
 * 같은 순수 계산만 모아 두었다. 여기 있는 함수는 파일이나 화면을 건드리지 않는다.
 * 덕분에 브라우저 없이 node 만으로 자체 점검(--selftest)을 돌릴 수 있다.
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

  /** 두 점으로 만든 사각형을 {x,y,w,h} 로 (왼쪽·위가 항상 작도록) */
  function rectFromPoints(x0, y0, x1, y1) {
    return {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      w: Math.abs(x1 - x0),
      h: Math.abs(y1 - y0),
    };
  }

  /** 화면(0,0,W,H) 밖으로 나가지 않게 자른다 */
  function clampRect(r, W, H) {
    var x = clamp(Math.round(r.x), 0, Math.max(0, W));
    var y = clamp(Math.round(r.y), 0, Math.max(0, H));
    var w = clamp(Math.round(r.w), 0, W - x);
    var h = clamp(Math.round(r.h), 0, H - y);
    return { x: x, y: y, w: w, h: h };
  }

  /** 크기는 그대로 두고 위치만 밀어 넣는다 (영역을 끌어 옮길 때) */
  function moveInside(r, W, H) {
    var w = Math.min(Math.round(r.w), W);
    var h = Math.min(Math.round(r.h), H);
    return {
      x: clamp(Math.round(r.x), 0, W - w),
      y: clamp(Math.round(r.y), 0, H - h),
      w: w,
      h: h,
    };
  }

  /**
   * 가로:세로 비율을 맞춘다. 넓이는 되도록 유지하면서 화면 밖으로 나가지 않게.
   * ratio 가 0 이하이면 아무것도 하지 않는다(자유 비율).
   */
  function snapAspect(r, ratio, W, H) {
    if (!ratio || ratio <= 0) return clampRect(r, W, H);
    var area = Math.max(1, r.w * r.h);
    var w = Math.sqrt(area * ratio);
    var h = w / ratio;
    if (w > W) { w = W; h = w / ratio; }
    if (h > H) { h = H; w = h * ratio; }
    var cx = r.x + r.w / 2;
    var cy = r.y + r.h / 2;
    return clampRect({ x: cx - w / 2, y: cy - h / 2, w: w, h: h }, W, H);
  }

  /**
   * 영상 압축기가 좋아하는 짝수 크기로 맞춘다.
   * (홀수 크기는 H.264·VP9 에서 거절당하거나 한 줄이 잘린다)
   */
  function evenRect(r, W, H) {
    var c = clampRect(r, W, H);
    var w = Math.max(2, c.w - (c.w % 2));
    var h = Math.max(2, c.h - (c.h % 2));
    var x = c.x - (c.x % 2);
    var y = c.y - (c.y % 2);
    if (x + w > W) w = Math.max(2, (W - x) - ((W - x) % 2));
    if (y + h > H) h = Math.max(2, (H - y) - ((H - y) % 2));
    return { x: x, y: y, w: w, h: h };
  }

  /**
   * 저장할 크기 정하기.
   *   scale: 'origin' 원본 그대로 · '1080' 긴 변 1920 · '720' 긴 변 1280 · '1440' 긴 변 2560
   * 원본보다 크게 늘리지는 않는다(늘려 봐야 화질이 좋아지지 않는다).
   */
  function outputSize(w, h, scale) {
    var caps = { origin: 0, '1440': 2560, '1080': 1920, '720': 1280 };
    var cap = caps[String(scale)] || 0;
    var ow = w, oh = h;
    var long = Math.max(w, h);
    if (cap && long > cap) {
      var k = cap / long;
      ow = Math.round(w * k);
      oh = Math.round(h * k);
    }
    ow = Math.max(2, ow - (ow % 2));
    oh = Math.max(2, oh - (oh % 2));
    return { w: ow, h: oh };
  }

  /**
   * 그림 화질(초당 비트 수) 정하기.
   * 픽셀 하나를 몇 비트로 그릴지(bpp)를 정해 두고 넓이·초당 장수를 곱한다.
   * 영상 재생 화면은 움직임이 많아 넉넉하게 잡는다.
   */
  var BPP = { saving: 0.045, std: 0.075, high: 0.13, max: 0.22 };

  function bitrateFor(w, h, fps, level) {
    var bpp = BPP[level] || BPP.high;
    var raw = w * h * Math.max(1, fps) * bpp;
    var v = clamp(raw, 1000000, 90000000);
    return Math.round(v / 100000) * 100000;
  }

  /** 소리 화질 */
  function audioBitrateFor(level) {
    if (level === 'saving') return 96000;
    if (level === 'std') return 160000;
    if (level === 'max') return 256000;
    return 192000;
  }

  /** 대략 몇 MB 쯤 될지 (1분 기준) */
  function sizePerMinute(videoBps, audioBps) {
    return Math.round(((videoBps + (audioBps || 0)) * 60) / 8);
  }

  /* ── 보기 좋은 글자 ──────────────────────────────────────────────── */

  function two(n) { return (n < 10 ? '0' : '') + n; }

  function fmtDuration(ms) {
    var t = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(t / 3600);
    var m = Math.floor((t % 3600) / 60);
    var s = t % 60;
    return (h > 0 ? h + ':' : '') + two(m) + ':' + two(s);
  }

  function fmtBytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  function fmtBps(bps) {
    if (bps >= 1000000) return (bps / 1000000).toFixed(1).replace(/\.0$/, '') + ' Mbps';
    return Math.round(bps / 1000) + ' kbps';
  }

  /* ── 파일 이름 ───────────────────────────────────────────────────── */

  /** 윈도우에서 못 쓰는 글자 걸러 내기 */
  function safeName(s) {
    var t = String(s === undefined || s === null ? '' : s)
      .split('').filter(function (ch) { return ch.charCodeAt(0) >= 32; }).join('')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/, '');
    if (!t) t = '녹화';
    return t.slice(0, 90);
  }

  /** '화면녹화 2026-08-25 14-33-02.mp4' 처럼 이름 짓기 */
  function stampName(prefix, date, ext) {
    var d = date || new Date();
    var stamp = d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate())
      + ' ' + two(d.getHours()) + '-' + two(d.getMinutes()) + '-' + two(d.getSeconds());
    var base = safeName(prefix || '화면녹화');
    var e = String(ext || 'mp4').replace(/^\./, '').toLowerCase();
    return base + ' ' + stamp + '.' + e;
  }

  /* ── 영상이 재생되는 곳 자동으로 찾기 ─────────────────────────────── */

  /**
   * 두 장면의 차이(diff)를 보고 "움직이는 네모"를 찾는다.
   *
   * diff : 픽셀마다 0~255 인 배열(작게 줄인 그림). w×h 개.
   * 화면에서 영상이 재생되는 곳만 계속 바뀌고 나머지는 가만히 있다는 성질을 쓴다.
   * 시계·깜빡이는 커서 같은 잔잡음에 끌려가지 않도록,
   *   ① 문턱값을 평균+표준편차로 잡아 웬만한 잡음을 버리고
   *   ② 가장자리에서 전체 움직임의 1% 씩을 깎아 낸 뒤 테두리를 잡는다.
   *
   * 돌려주는 값은 diff 격자 기준 {x,y,w,h,ratio}. 못 찾으면 null.
   */
  function autoRegion(diff, w, h, opts) {
    opts = opts || {};
    var total = w * h;
    if (!total || !diff || diff.length < total) return null;

    var i, v;
    var sum = 0;
    for (i = 0; i < total; i++) sum += diff[i];
    var mean = sum / total;

    var varSum = 0;
    for (i = 0; i < total; i++) { v = diff[i] - mean; varSum += v * v; }
    var sd = Math.sqrt(varSum / total);

    var floor = opts.minThreshold === undefined ? 10 : opts.minThreshold;
    var k = opts.k === undefined ? 2.2 : opts.k;
    var thr = Math.max(floor, mean + k * sd);

    var colE = new Float64Array(w);
    var rowE = new Float64Array(h);
    var energy = 0;
    var hot = 0;
    for (var y = 0; y < h; y++) {
      var base = y * w;
      for (var x = 0; x < w; x++) {
        v = diff[base + x];
        if (v >= thr) { colE[x] += v; rowE[y] += v; energy += v; hot++; }
      }
    }

    var minHot = Math.max(opts.minPixels === undefined ? 30 : opts.minPixels, total * 0.0006);
    if (hot < minHot || energy <= 0) return null;

    var trim = opts.trim === undefined ? 0.01 : opts.trim;
    var xs = span(colE, energy, trim);
    var ys = span(rowE, energy, trim);
    var rect = { x: xs[0], y: ys[0], w: xs[1] - xs[0] + 1, h: ys[1] - ys[0] + 1 };
    rect.ratio = (rect.w * rect.h) / total;
    return rect;
  }

  /** 양 끝에서 전체 에너지의 trim 만큼씩 깎고 남은 구간 [처음, 끝] */
  function span(arr, energy, trim) {
    var need = energy * trim;
    var n = arr.length;
    var acc = 0;
    var a = 0;
    while (a < n - 1 && acc + arr[a] <= need) { acc += arr[a]; a++; }
    acc = 0;
    var b = n - 1;
    while (b > a && acc + arr[b] <= need) { acc += arr[b]; b--; }
    return [a, b];
  }

  /** 자동으로 찾은 네모가 흔한 화면 비율에 가까우면 딱 맞춰 준다 */
  function tidyRatio(r, W, H, tol) {
    var t = tol === undefined ? 0.035 : tol;
    var common = [16 / 9, 16 / 10, 4 / 3, 21 / 9, 1, 9 / 16];
    var cur = r.w / Math.max(1, r.h);
    var best = null;
    for (var i = 0; i < common.length; i++) {
      var d = Math.abs(cur - common[i]) / common[i];
      if (d <= t && (!best || d < best.d)) best = { d: d, ratio: common[i] };
    }
    if (!best) return clampRect(r, W, H);
    return snapAspect(r, best.ratio, W, H);
  }

  /* ── 저장 이름 겹칠 때 ───────────────────────────────────────────── */

  /** '이름.mp4' → '이름 (2).mp4' */
  function bumpName(name, n) {
    var dot = name.lastIndexOf('.');
    var base = dot > 0 ? name.slice(0, dot) : name;
    var ext = dot > 0 ? name.slice(dot) : '';
    return base + ' (' + n + ')' + ext;
  }

  return {
    clamp: clamp,
    rectFromPoints: rectFromPoints,
    clampRect: clampRect,
    moveInside: moveInside,
    snapAspect: snapAspect,
    evenRect: evenRect,
    outputSize: outputSize,
    bitrateFor: bitrateFor,
    audioBitrateFor: audioBitrateFor,
    sizePerMinute: sizePerMinute,
    fmtDuration: fmtDuration,
    fmtBytes: fmtBytes,
    fmtBps: fmtBps,
    safeName: safeName,
    stampName: stampName,
    autoRegion: autoRegion,
    tidyRatio: tidyRatio,
    bumpName: bumpName,
    BPP: BPP,
  };
}));
