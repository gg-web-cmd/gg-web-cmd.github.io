/* 얼굴 위치에서 자를 자리를 셈한다.
 *
 * 이 파일은 **브라우저와 Node 양쪽에서 쓴다.** 화면이 실제로 쓰는 계산을
 * 자체 점검이 그대로 불러 확인하려는 것이다 (베껴 두면 언젠가 어긋난다).
 *
 * 증명사진의 관례
 * ---------------
 * 여권·주민등록용 증명사진은 머리(정수리~턱)가 사진 높이의 70% 안팎을 차지하고,
 * 정수리 위에 5~10% 정도 여백이 남는다. 얼굴이 너무 크면 답답하고, 너무 작으면
 * 증명사진처럼 안 보인다.
 *
 * 얼굴 찾기가 주는 상자는 대략 **눈썹부터 턱까지**다. 머리카락과 이마 위쪽은
 * 안 들어온다. 그래서 머리 전체 높이를 그 상자의 1.5배쯤으로 잡는다(실측 기준).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CropMath = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 얼굴 상자 → 머리 전체 높이로 늘리는 배수 */
  const HEAD_FROM_FACE = 1.5;

  const DEFAULTS = {
    headRatio: 0.70,     // 머리가 사진 높이에서 차지하는 몫
    eyeLine: 0.45,       // 얼굴 중심이 사진에서 위로부터 어디쯤 오는가
    ratioW: 3,
    ratioH: 4,
  };

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /**
   * 얼굴 상자를 보고 자를 네모를 셈한다.
   *
   * @param face  {x, y, width, height} 얼굴 상자 (원본 사진 좌표)
   * @param img   {width, height} 원본 사진 크기
   * @param opt   {headRatio, eyeLine, ratioW, ratioH, nudgeY, zoom}
   * @returns {{x, y, width, height, fitted:boolean, why:string}}
   *          fitted=false 면 원하는 크기가 사진 밖으로 나가 줄여 맞춘 것이다.
   */
  function fromFace(face, img, opt) {
    const o = Object.assign({}, DEFAULTS, opt || {});
    const aspect = o.ratioW / o.ratioH;

    const headH = face.height * HEAD_FROM_FACE;
    let h = headH / clamp(o.headRatio, 0.35, 0.95);
    h = h / clamp(o.zoom || 1, 0.4, 3);          // 사람이 손으로 확대·축소한 몫
    let w = h * aspect;

    let fitted = true;
    let why = '';

    /* 사진보다 커지면 들어갈 만큼 줄인다 (비율은 지킨다) */
    if (w > img.width || h > img.height) {
      const k = Math.min(img.width / w, img.height / h);
      w *= k; h *= k;
      fitted = false;
      why = '사진이 작아 얼굴을 더 크게 잡을 수 없습니다';
    }

    const cx = face.x + face.width / 2;
    const cy = face.y + face.height / 2;

    let x = cx - w / 2;
    let y = cy - h * clamp(o.eyeLine, 0.2, 0.7) + (o.nudgeY || 0) * h;

    /* 사진 밖으로 나가면 안쪽으로 민다 */
    const nx = clamp(x, 0, Math.max(0, img.width - w));
    const ny = clamp(y, 0, Math.max(0, img.height - h));
    if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) {
      fitted = false;
      if (!why) why = '얼굴이 가장자리에 붙어 있어 자리를 밀었습니다';
    }
    x = nx; y = ny;

    return { x, y, width: w, height: h, fitted, why };
  }

  /**
   * 얼굴을 못 찾았을 때. 가운데를 기준으로 하되 위쪽으로 조금 올려 잡는다
   * (사람 사진은 머리가 위에 있으므로 한가운데보다 위가 낫다).
   */
  function centered(img, opt) {
    const o = Object.assign({}, DEFAULTS, opt || {});
    const aspect = o.ratioW / o.ratioH;

    let w = img.width;
    let h = w / aspect;
    if (h > img.height) { h = img.height; w = h * aspect; }

    const zoom = clamp(o.zoom || 1, 0.4, 3);
    w /= zoom; h /= zoom;
    if (w > img.width) { w = img.width; h = w / aspect; }
    if (h > img.height) { h = img.height; w = h * aspect; }

    const x = clamp((img.width - w) / 2, 0, Math.max(0, img.width - w));
    /* 한가운데보다 8% 위 */
    const y = clamp((img.height - h) / 2 - h * 0.08 + (o.nudgeY || 0) * h,
      0, Math.max(0, img.height - h));

    return { x, y, width: w, height: h, fitted: false, why: '얼굴을 못 찾아 가운데로 잡았습니다' };
  }

  /**
   * 사진을 담을 상자 안에 들어가게 크기를 정한다 (비율 그대로).
   * 규격 사진이 아니라 "긴 변 1280" 같은 경우에 쓴다.
   */
  function fitInside(img, maxLong) {
    const long = Math.max(img.width, img.height);
    if (!maxLong || long <= maxLong) return { width: img.width, height: img.height, scaled: false };
    const k = maxLong / long;
    return { width: Math.round(img.width * k), height: Math.round(img.height * k), scaled: true };
  }

  /** 여러 얼굴이 잡히면 가장 큰 것을 고른다 (증명사진은 한 사람이다) */
  function biggest(faces) {
    if (!faces || !faces.length) return null;
    let best = faces[0];
    for (const f of faces) if (f.width * f.height > best.width * best.height) best = f;
    return best;
  }

  /**
   * 목표 용량에 맞는 품질을 찾는 이분 탐색의 다음 시도값.
   * encode 는 부르는 쪽(브라우저)이 하고, 여기서는 다음에 어떤 품질을 시도할지만 정한다.
   */
  function nextQuality(state, size, targetBytes) {
    const s = state || { lo: 0.30, hi: 0.95, q: 0.85, best: null, tries: 0 };
    s.tries += 1;
    if (size <= targetBytes) {
      s.best = s.q;              // 이 품질로 들어갔다 — 더 좋게 해 볼 여지가 있다
      s.lo = s.q;
    } else {
      s.hi = s.q;
    }
    s.q = (s.lo + s.hi) / 2;
    s.done = s.tries >= 7 || (s.hi - s.lo) < 0.03;
    return s;
  }

  return { fromFace, centered, fitInside, biggest, nextQuality, DEFAULTS, HEAD_FROM_FACE, clamp };
}));
