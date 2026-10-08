/* 미리 보기 위에서 녹화할 네모 고르기.
 *
 * 잡아 온 화면을 그대로 보여 주고, 그 위에서 끌어서 영역을 정한다.
 * 미리 보기가 실제 화면보다 작아도 좌표는 언제나 "실제 그림 좌표"로 다룬다 —
 * 그래야 4K 화면에서도 1픽셀까지 정확하게 잘린다.
 *
 * 할 수 있는 것
 *   · 빈 곳에서 끌기      → 새 영역
 *   · 안쪽에서 끌기      → 영역 옮기기
 *   · 모서리·변에서 끌기 → 크기 바꾸기
 *   · 화살표 키          → 1픽셀씩(Shift 는 10픽셀씩) 밀기
 *   · 두 번 누르기       → 화면 전체
 *   · 자동 찾기          → 지금 움직이고 있는 곳(=영상이 재생되는 곳)을 스스로 잡아 준다
 */
window.RegionPicker = (function () {
  'use strict';

  const S = window.Shared;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const HIT = 11;          // 손잡이 잡히는 범위(화면 픽셀)

  function create(opts) {
    const stage = opts.stage;
    const video = opts.video;
    const canvas = opts.canvas;
    const magnifier = opts.magnifier;
    const onChange = opts.onChange || function () {};

    let sw = 0;
    let sh = 0;                       // 원본 그림 크기
    let rect = null;                  // 원본 좌표의 {x,y,w,h}
    let aspect = 0;                   // 0 이면 자유
    let drag = null;
    let hover = '';
    let enabled = false;

    const ctx = canvas.getContext('2d');

    /* ── 좌표 옮기기 ─────────────────────────────────────────────── */

    function box() {
      const r = canvas.getBoundingClientRect();
      return { w: r.width || 1, h: r.height || 1, left: r.left, top: r.top };
    }
    function toSource(px, py) {
      const b = box();
      return { x: (px / b.w) * sw, y: (py / b.h) * sh };
    }
    function toScreen(x, y) {
      const b = box();
      return { x: (x / sw) * b.w, y: (y / sh) * b.h };
    }
    function scale() { const b = box(); return b.w / (sw || 1); }

    /* ── 그리기 ──────────────────────────────────────────────────── */

    function fit() {
      const b = box();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(b.w * dpr));
      const h = Math.max(1, Math.round(b.h * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      draw();
    }

    function draw() {
      const b = box();
      const dpr = canvas.width / b.w;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, b.w, b.h);
      if (!sw || !sh) return;

      /* 아직 고른 곳이 없으면 화면을 가리지 않는다 — 어디를 고를지 잘 보여야 한다 */
      if (!rect || rect.w <= 0 || rect.h <= 0) return;

      /* 고른 곳 빼고 어둡게 */
      ctx.fillStyle = 'rgba(8,10,14,.58)';
      ctx.fillRect(0, 0, b.w, b.h);
      const p = toScreen(rect.x, rect.y);
      const q = toScreen(rect.x + rect.w, rect.y + rect.h);
      const rw = q.x - p.x;
      const rh = q.y - p.y;
      ctx.clearRect(p.x, p.y, rw, rh);

      /* 셋으로 나눈 안내선 */
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(p.x + (rw * i) / 3, p.y);
        ctx.lineTo(p.x + (rw * i) / 3, p.y + rh);
        ctx.moveTo(p.x, p.y + (rh * i) / 3);
        ctx.lineTo(p.x + rw, p.y + (rh * i) / 3);
      }
      ctx.stroke();
      ctx.restore();

      /* 테두리 */
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + .5, p.y + .5, rw - 1, rh - 1);
      ctx.strokeStyle = '#e8433c';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 1.5, p.y + 1.5, rw - 3, rh - 3);

      /* 손잡이 */
      for (const key of HANDLES) {
        const c = handleAt(key, p.x, p.y, rw, rh);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#e8433c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(c.x - 4.5, c.y - 4.5, 9, 9);
        ctx.fill();
        ctx.stroke();
      }

      /* 크기 알려 주기 */
      const label = Math.round(rect.w) + ' × ' + Math.round(rect.h);
      ctx.font = '600 12px "Malgun Gothic", sans-serif';
      const tw = ctx.measureText(label).width + 14;
      let lx = p.x;
      let ly = p.y - 24;
      if (ly < 2) ly = p.y + 6;
      if (lx + tw > b.w) lx = b.w - tw;
      ctx.fillStyle = 'rgba(20,22,28,.85)';
      ctx.fillRect(lx, ly, tw, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, lx + 7, ly + 14);
    }

    function handleAt(key, x, y, w, h) {
      const mx = x + w / 2;
      const my = y + h / 2;
      if (key === 'nw') return { x: x, y: y };
      if (key === 'n') return { x: mx, y: y };
      if (key === 'ne') return { x: x + w, y: y };
      if (key === 'e') return { x: x + w, y: my };
      if (key === 'se') return { x: x + w, y: y + h };
      if (key === 's') return { x: mx, y: y + h };
      if (key === 'sw') return { x: x, y: y + h };
      return { x: x, y: my };            // w
    }

    function hitTest(px, py) {
      if (!rect) return '';
      const p = toScreen(rect.x, rect.y);
      const q = toScreen(rect.x + rect.w, rect.y + rect.h);
      const w = q.x - p.x;
      const h = q.y - p.y;
      for (const key of HANDLES) {
        const c = handleAt(key, p.x, p.y, w, h);
        if (Math.abs(px - c.x) <= HIT && Math.abs(py - c.y) <= HIT) return key;
      }
      if (px > p.x && px < q.x && py > p.y && py < q.y) return 'move';
      return '';
    }

    const CURSORS = {
      nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
      n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
      move: 'move', '': 'crosshair',
    };

    /* ── 돋보기 ──────────────────────────────────────────────────── */

    function showMagnifier(px, py) {
      if (!magnifier || !video || !video.videoWidth) return;
      const MW = 176;
      const MH = 118;
      const ZOOM = 5;
      if (magnifier.width !== MW) { magnifier.width = MW; magnifier.height = MH; }
      const g = magnifier.getContext('2d');
      const s = toSource(px, py);
      const srcW = MW / ZOOM;
      const srcH = MH / ZOOM;
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#000';
      g.fillRect(0, 0, MW, MH);
      try {
        g.drawImage(video, s.x - srcW / 2, s.y - srcH / 2, srcW, srcH, 0, 0, MW, MH);
      } catch (_) {}
      g.strokeStyle = 'rgba(232,67,60,.9)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(MW / 2 + .5, 0); g.lineTo(MW / 2 + .5, MH);
      g.moveTo(0, MH / 2 + .5); g.lineTo(MW, MH / 2 + .5);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.strokeRect(.5, .5, MW - 1, MH - 1);

      const b = box();
      let mx = px + 22;
      let my = py + 22;
      if (mx + MW > b.w) mx = px - MW - 22;
      if (my + MH > b.h) my = py - MH - 22;
      magnifier.style.left = Math.max(0, mx) + 'px';
      magnifier.style.top = Math.max(0, my) + 'px';
      magnifier.classList.remove('hidden');
    }

    function hideMagnifier() {
      if (magnifier) magnifier.classList.add('hidden');
    }

    /* ── 끌기 ────────────────────────────────────────────────────── */

    function local(e) {
      const b = box();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    }

    function onDown(e) {
      if (!enabled || !sw) return;
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      const hit = hitTest(p.x, p.y);
      const s = toSource(p.x, p.y);
      if (hit === 'move') drag = { kind: 'move', ox: s.x - rect.x, oy: s.y - rect.y };
      else if (hit) drag = { kind: 'resize', key: hit, start: { ...rect } };
      else drag = { kind: 'new', x0: s.x, y0: s.y };
      onMove(e);
    }

    function onMove(e) {
      if (!enabled || !sw) return;
      const p = local(e);
      if (!drag) {
        hover = hitTest(p.x, p.y);
        canvas.style.cursor = CURSORS[hover] || 'crosshair';
        hideMagnifier();
        return;
      }
      const s = toSource(p.x, p.y);
      if (drag.kind === 'new') {
        rect = S.rectFromPoints(drag.x0, drag.y0, s.x, s.y);
        if (aspect) rect = S.snapAspect(rect, aspect, sw, sh);
      } else if (drag.kind === 'move') {
        rect = S.moveInside({ x: s.x - drag.ox, y: s.y - drag.oy, w: rect.w, h: rect.h }, sw, sh);
      } else {
        rect = resized(drag.start, drag.key, s);
        if (aspect) rect = S.snapAspect(rect, aspect, sw, sh);
      }
      rect = S.clampRect(rect, sw, sh);
      showMagnifier(p.x, p.y);
      draw();
      onChange(getRect(), true);
    }

    function onUp(e) {
      if (!drag) return;
      drag = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      hideMagnifier();
      if (rect && (rect.w < 16 || rect.h < 16)) rect = null;      // 손이 미끄러진 정도는 무시
      if (rect) rect = S.evenRect(rect, sw, sh);
      draw();
      onChange(getRect(), false);
    }

    function resized(start, key, s) {
      let x0 = start.x;
      let y0 = start.y;
      let x1 = start.x + start.w;
      let y1 = start.y + start.h;
      if (key.indexOf('n') >= 0) y0 = s.y;
      if (key.indexOf('s') >= 0) y1 = s.y;
      if (key.indexOf('w') >= 0) x0 = s.x;
      if (key.indexOf('e') >= 0) x1 = s.x;
      return S.rectFromPoints(x0, y0, x1, y1);
    }

    function onKey(e) {
      if (!enabled || !rect) return;
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      if (e.altKey) {
        rect = S.clampRect({ x: rect.x, y: rect.y, w: rect.w + dx, h: rect.h + dy }, sw, sh);
      } else {
        rect = S.moveInside({ x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h }, sw, sh);
      }
      draw();
      onChange(getRect(), false);
    }

    function onDouble() {
      if (!enabled || !sw) return;
      selectAll();
    }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', () => { if (!drag) hideMagnifier(); });
    canvas.addEventListener('dblclick', onDouble);
    canvas.addEventListener('keydown', onKey);

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => fit());
      ro.observe(stage);
    } else {
      window.addEventListener('resize', fit);
    }

    /* ── 바깥에서 부르는 것 ──────────────────────────────────────── */

    function setSource(w, h) {
      sw = Math.round(w) || 0;
      sh = Math.round(h) || 0;
      enabled = !!(sw && sh);
      if (stage && sw && sh) stage.style.aspectRatio = sw + ' / ' + sh;
      if (rect) rect = S.clampRect(rect, sw, sh);
      fit();
    }

    function getRect() {
      if (!rect || !sw) return null;
      const r = S.evenRect(rect, sw, sh);
      return { x: r.x, y: r.y, w: r.w, h: r.h, sw: sw, sh: sh };
    }

    function setRect(r) {
      if (!r || !sw) { rect = null; draw(); onChange(null, false); return; }
      rect = S.evenRect(S.clampRect(r, sw, sh), sw, sh);
      draw();
      onChange(getRect(), false);
    }

    function selectAll() {
      if (!sw) return;
      setRect({ x: 0, y: 0, w: sw, h: sh });
    }

    function clear() {
      rect = null;
      draw();
      onChange(null, false);
    }

    function setAspect(text) {
      if (!text || text === 'free') { aspect = 0; return; }
      const m = /^(\d+):(\d+)$/.exec(text);
      aspect = m ? (Number(m[1]) / Number(m[2])) : 0;
      if (aspect && rect) {
        rect = S.evenRect(S.snapAspect(rect, aspect, sw, sh), sw, sh);
        draw();
        onChange(getRect(), false);
      }
    }

    /**
     * 영상이 재생되는 곳 자동으로 찾기.
     * 잠깐(1.5초쯤) 화면을 지켜보면서 "계속 바뀌는 곳" 의 테두리를 잡는다.
     */
    async function autoFind(onProgress) {
      if (!sw || !sh || !video || !video.videoWidth) return null;
      const GW = 320;
      const GH = Math.max(2, Math.round((GW * sh) / sw));
      const c = document.createElement('canvas');
      c.width = GW;
      c.height = GH;
      const g = c.getContext('2d', { willReadFrequently: true });

      const acc = new Uint8ClampedArray(GW * GH);
      let prev = null;
      const SHOTS = 9;
      for (let i = 0; i < SHOTS; i++) {
        try { g.drawImage(video, 0, 0, GW, GH); }
        catch (_) { return null; }
        const px = g.getImageData(0, 0, GW, GH).data;
        const gray = new Uint8ClampedArray(GW * GH);
        for (let p = 0, q = 0; q < gray.length; p += 4, q++) {
          gray[q] = (px[p] * 77 + px[p + 1] * 150 + px[p + 2] * 29) >> 8;
        }
        if (prev) {
          for (let q = 0; q < gray.length; q++) {
            const d = Math.abs(gray[q] - prev[q]);
            if (d > acc[q]) acc[q] = d;
          }
        }
        prev = gray;
        if (onProgress) onProgress((i + 1) / SHOTS);
        if (i < SHOTS - 1) await sleep(170);
      }

      const found = S.autoRegion(acc, GW, GH, {});
      if (!found) return null;
      /* 격자 한 칸만큼 넉넉히 잡는다 — 살펴본 그림이 작게 줄인 것이라 테두리가 반 칸씩 잘린다 */
      const kx = sw / GW;
      const ky = sh / GH;
      let out = S.clampRect({
        x: Math.floor((found.x - 1) * kx),
        y: Math.floor((found.y - 1) * ky),
        w: Math.ceil((found.w + 2) * kx),
        h: Math.ceil((found.h + 2) * ky),
      }, sw, sh);
      out = S.tidyRatio(out, sw, sh);
      out = S.evenRect(out, sw, sh);
      if (out.w < 32 || out.h < 32) return null;
      setRect(out);
      return getRect();
    }

    return {
      setSource, getRect, setRect, selectAll, clear, setAspect, autoFind, draw, fit,
      source() { return { w: sw, h: sh }; },
    };
  }

  return { create };
}());
