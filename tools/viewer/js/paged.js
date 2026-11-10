/* 쪽으로 나뉜 문서(PDF·한글·여러 쪽 TIFF·슬라이드 그림)를 보여 주는 공용 틀.
 *
 * 모든 쪽 자리를 먼저 크기대로 깔아 두고, 화면 가까이 온 쪽만 실제로 그린다.
 * 600쪽짜리 문서도 처음 몇 쪽만 그리므로 바로 열린다.
 *
 * src (형식별 렌더러가 넘겨 주는 것)
 *   pageCount                       쪽 수
 *   pageSize(i) -> {w, h}           100% 일 때 CSS px (돌리기 전)
 *   render(i, box, scale, rot)      box 안에 그리기 (Promise)
 *   release?(i, box)                메모리 놓기
 *   pageText?(i) -> Promise<string> 찾기용 글
 *   printPage?(i) -> Promise<Node>  인쇄용 한 쪽 (img/svg)
 *   rotatable                       돌리기 지원
 */
import { el, nextFrame, countMatches } from './util.js';
import { highlightText, clearHighlight } from './find.js';

const GAP = 14;
const PAD = 16;

export class PagedView {
  constructor(container, src, opts) {
    this.src = src;
    this.opts = opts || {};
    this.root = el('div', { class: 'paged' });
    this.inner = el('div', { class: 'pages' });
    this.root.appendChild(this.inner);
    container.appendChild(this.root);
    this.count = src.pageCount;
    this.mode = this.opts.zoom || 'width';
    this.scale = 1;
    this.rot = 0;
    this.cur = 0;
    this.boxes = [];
    this.rendered = new Map(); // i -> scale key
    this.textCache = new Map();
    this.token = 0;
    this.queue = null;

    for (let i = 0; i < this.count; i++) {
      const box = el('div', { class: 'pg', 'data-i': i });
      box.appendChild(el('div', { class: 'pg-label', text: String(i + 1) }));
      this.inner.appendChild(box);
      this.boxes.push(box);
    }

    this.io = new IntersectionObserver(() => this.schedule(), { root: this.root, rootMargin: '150% 0px' });
    this.boxes.forEach((b) => this.io.observe(b));
    this.onScroll = () => { this.trackPage(); };
    this.root.addEventListener('scroll', this.onScroll, { passive: true });
    this.ro = new ResizeObserver(() => {
      if (typeof this.mode === 'string') this.applyZoom(true);
    });
    this.ro.observe(this.root);
    this.applyZoom(false);
  }

  get pageCount() { return this.count; }
  get rotatable() { return !!this.src.rotatable; }

  size(i) {
    const s = this.src.pageSize(i) || { w: 800, h: 1100 };
    return this.rot % 180 ? { w: s.h, h: s.w } : { w: s.w, h: s.h };
  }

  /** 맞춤 방식을 실제 배율로 */
  computeScale() {
    if (typeof this.mode === 'number') return this.mode;
    const vw = Math.max(200, this.root.clientWidth - PAD * 2 - 4);
    const vh = Math.max(200, this.root.clientHeight - PAD * 2);
    const s = this.size(this.cur);
    if (this.mode === 'page') return Math.min(vw / s.w, vh / s.h);
    if (this.mode === 'fit') return Math.min(1, vw / s.w, vh / s.h); // 그림: 크면 줄이고 작으면 그대로
    if (this.mode === 'auto') return Math.min(1.2, vw / s.w);
    return vw / s.w; // width
  }

  applyZoom(keepPos) {
    const anchor = keepPos ? this.anchor() : null;
    const scale = Math.max(0.1, Math.min(8, this.computeScale()));
    const changed = Math.abs(scale - this.scale) > 0.001;
    this.scale = scale;
    for (let i = 0; i < this.count; i++) {
      const s = this.size(i);
      const b = this.boxes[i];
      const w = Math.round(s.w * scale), h = Math.round(s.h * scale);
      b.style.width = w + 'px';
      b.style.height = h + 'px';
      // 이미 그린 쪽은 다시 그리기 전까지 늘려서라도 자리에 맞춘다
      if (changed && this.rendered.has(i)) {
        if (this.src.resize) { try { this.src.resize(i, b, scale, this.rot); } catch (_) {} }
        b.querySelectorAll(':scope > canvas, :scope > svg').forEach((c) => { c.style.width = w + 'px'; c.style.height = h + 'px'; });
      }
    }
    if (anchor) this.restore(anchor);
    if (changed || !keepPos) {
      this.token++;
      this.schedule();
    }
    if (this.opts.onZoom) this.opts.onZoom(this.scale, this.mode);
  }

  setZoom(mode) {
    this.mode = mode;
    this.applyZoom(true);
  }

  zoomBy(f) {
    const next = Math.max(0.1, Math.min(8, this.scale * f));
    this.setZoom(Math.round(next * 100) / 100);
  }

  rotate(delta) {
    if (!this.rotatable) return;
    this.rot = (this.rot + (delta || 90) + 360) % 360;
    const keep = this.cur;
    this.rendered.clear();
    this.boxes.forEach((b, i) => this.clearBox(i, b));
    this.applyZoom(false);
    this.goTo(keep, true);
  }

  anchor() {
    const b = this.boxes[this.cur];
    if (!b) return null;
    const off = this.root.scrollTop - b.offsetTop;
    return { i: this.cur, frac: b.offsetHeight ? off / b.offsetHeight : 0 };
  }

  restore(a) {
    const b = this.boxes[a.i];
    if (!b) return;
    this.root.scrollTop = b.offsetTop + a.frac * b.offsetHeight;
  }

  goTo(i, instant) {
    i = Math.max(0, Math.min(this.count - 1, i | 0));
    const b = this.boxes[i];
    if (!b) return;
    this.root.scrollTo({ top: b.offsetTop - 8, behavior: instant ? 'auto' : 'auto' });
    this.cur = i;
    if (this.opts.onPage) this.opts.onPage(i);
    this.schedule();
  }

  next() { this.goTo(this.cur + 1); }
  prev() { this.goTo(this.cur - 1); }

  trackPage() {
    const top = this.root.scrollTop + this.root.clientHeight * 0.3;
    // 이진 탐색: offsetTop 이 top 이하인 마지막 쪽
    let lo = 0, hi = this.count - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.boxes[mid].offsetTop <= top) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (ans !== this.cur) {
      this.cur = ans;
      if (this.opts.onPage) this.opts.onPage(ans);
    }
  }

  /** 화면 가까운 쪽부터 차례로 그린다. */
  schedule() {
    if (this.queue) { this.queueDirty = true; return; }
    this.queue = this.run().finally(() => {
      this.queue = null;
      if (this.queueDirty) { this.queueDirty = false; this.schedule(); }
    });
  }

  visibleRange() {
    const top = this.root.scrollTop - this.root.clientHeight * 1.0;
    const bot = this.root.scrollTop + this.root.clientHeight * 2.0;
    const out = [];
    for (let i = 0; i < this.count; i++) {
      const b = this.boxes[i];
      const t = b.offsetTop, h = b.offsetHeight;
      if (t + h >= top && t <= bot) out.push(i);
      else if (t > bot) break;
    }
    return out;
  }

  async run() {
    const token = this.token;
    const key = this.scale.toFixed(3) + '/' + this.rot;
    const mid = this.root.scrollTop + this.root.clientHeight / 2;
    const want = this.visibleRange().sort((a, b) =>
      Math.abs(this.boxes[a].offsetTop - mid) - Math.abs(this.boxes[b].offsetTop - mid));
    for (const i of want) {
      if (token !== this.token || this.destroyed) return;
      if (this.rendered.get(i) === key) continue;
      const box = this.boxes[i];
      box.classList.add('loading');
      try {
        await this.src.render(i, box, this.scale, this.rot);
        this.rendered.set(i, key);
        if (this.hlQuery) this.highlightBox(i);
      } catch (e) {
        if (this.destroyed) return;
        console.error(e);
        box.appendChild(el('div', { class: 'pg-error', text: (i + 1) + '쪽을 그리지 못했습니다: ' + (e && e.message || e) }));
        this.rendered.set(i, key);
      } finally {
        box.classList.remove('loading');
      }
      await nextFrame();
    }
    this.evict(want);
  }

  /** 너무 많이 그려 두면 메모리를 많이 쓴다. 멀리 있는 쪽은 놓는다. */
  evict(keep) {
    const LIMIT = 24;
    if (this.rendered.size <= LIMIT) return;
    const keepSet = new Set(keep);
    const far = [...this.rendered.keys()].filter((i) => !keepSet.has(i))
      .sort((a, b) => Math.abs(b - this.cur) - Math.abs(a - this.cur));
    for (const i of far.slice(0, this.rendered.size - LIMIT)) {
      this.clearBox(i, this.boxes[i]);
      this.rendered.delete(i);
    }
  }

  clearBox(i, box) {
    if (this.src.release) { try { this.src.release(i, box); } catch (_) {} }
    [...box.children].forEach((c) => { if (!c.classList.contains('pg-label')) c.remove(); });
  }

  /* ------------------------------------------------------------ 찾기 */

  async pageText(i) {
    if (!this.src.pageText) return '';
    if (this.textCache.has(i)) return this.textCache.get(i);
    let t = '';
    try { t = await this.src.pageText(i); } catch (_) { t = ''; }
    this.textCache.set(i, t);
    return t;
  }

  get searchable() { return !!this.src.pageText; }

  /** 쪽마다 몇 번 나오는지. onProgress(done, total) */
  async search(q, onProgress) {
    const hits = [];
    this.hlQuery = q;
    for (let i = 0; i < this.count; i++) {
      const n = countMatches(await this.pageText(i), q);
      if (n) hits.push({ page: i, count: n });
      if (onProgress && i % 5 === 0) { onProgress(i + 1, this.count); await nextFrame(); }
    }
    this.boxes.forEach((_, i) => { if (this.rendered.has(i)) this.highlightBox(i); });
    return hits;
  }

  highlightBox(i) {
    highlightText(this.boxes[i], this.hlQuery, 'p' + i);
  }

  clearSearch() {
    this.hlQuery = '';
    clearHighlight();
  }

  /* ------------------------------------------------------------ 인쇄 */

  async printItems(onProgress) {
    const out = [];
    for (let i = 0; i < this.count; i++) {
      if (onProgress) onProgress(i, this.count);
      const node = this.src.printPage ? await this.src.printPage(i, this.rot) : null;
      if (node) out.push({ node, size: this.size(i) });
      await nextFrame();
    }
    return out;
  }

  destroy() {
    this.destroyed = true;
    this.token++;
    this.io.disconnect();
    this.ro.disconnect();
    this.root.removeEventListener('scroll', this.onScroll);
    this.boxes.forEach((b, i) => { if (this.rendered.has(i)) this.clearBox(i, b); });
    if (this.src.destroy) { try { this.src.destroy(); } catch (_) {} }
    this.root.remove();
  }
}
