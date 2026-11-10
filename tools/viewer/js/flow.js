/* 쪽 나눔 없이 이어지는 문서(워드·마크다운·표·텍스트·슬라이드 목록)를 보여 주는 틀.
 *
 * 확대는 CSS zoom 으로 한다. pageSelector 를 주면 그 요소들을 '쪽'으로 보고
 * 쪽 이동·현재 쪽 표시를 한다(워드 쪽, 슬라이드). */
import { el } from './util.js';
import { FlowFinder } from './find.js';

export class FlowView {
  constructor(container, opts) {
    this.opts = opts || {};
    this.root = el('div', { class: 'flow ' + (this.opts.className || '') });
    this.content = el('div', { class: 'flow-inner' });
    this.root.appendChild(this.content);
    container.appendChild(this.root);
    this.mode = this.opts.zoom || 'width';
    this.scale = 1;
    this.cur = 0;
    this.pages = [];
    this.finder = new FlowFinder(this.content);
    this.onScroll = () => this.trackPage();
    this.root.addEventListener('scroll', this.onScroll, { passive: true });
    this.ro = new ResizeObserver(() => { if (typeof this.mode === 'string') this.applyZoom(); });
    this.ro.observe(this.root);
  }

  /** 내용을 다 넣은 뒤 부른다. */
  ready() {
    if (this.opts.pageSelector) this.pages = [...this.content.querySelectorAll(this.opts.pageSelector)];
    this.applyZoom();
    this.trackPage();
  }

  get pageCount() { return this.pages.length; }
  get searchable() { return true; }
  get rotatable() { return false; }

  /** 맞춤 기준 너비: 쪽이 있으면 가장 넓은 쪽, 아니면 opts.naturalWidth */
  baseWidth() {
    if (this.opts.naturalWidth) return this.opts.naturalWidth;
    if (!this.pages.length) return 0;
    const z = this.scale || 1;
    let w = 0;
    for (const p of this.pages.slice(0, 20)) w = Math.max(w, p.getBoundingClientRect().width / z);
    return w || 0;
  }

  computeScale() {
    if (typeof this.mode === 'number') return this.mode;
    const bw = this.baseWidth();
    if (!bw) return 1; // 글 흐름 문서는 100% 가 곧 폭 맞춤
    const avail = Math.max(200, this.root.clientWidth - 40);
    if (this.mode === 'page' && this.pages.length) {
      const p = this.pages[this.cur] || this.pages[0];
      const ph = (p.getBoundingClientRect().height / (this.scale || 1)) || 1;
      return Math.min(avail / bw, (this.root.clientHeight - 30) / ph);
    }
    if (this.mode === 'auto') return Math.min(1, avail / bw);
    return avail / bw;
  }

  /** 스크롤 상자 기준 요소의 위쪽 위치(확대 반영) */
  top(e) {
    return e.getBoundingClientRect().top - this.root.getBoundingClientRect().top + this.root.scrollTop;
  }

  applyZoom() {
    const anchor = this.pages[this.cur];
    const off = anchor ? this.root.scrollTop - this.top(anchor) : 0;
    const frac = this.root.scrollHeight ? this.root.scrollTop / this.root.scrollHeight : 0;
    const s = Math.max(0.1, Math.min(6, this.computeScale()));
    const ratio = s / (this.scale || 1);
    this.scale = s;
    this.content.style.zoom = s === 1 ? '' : String(s);
    if (anchor) this.root.scrollTop = this.top(anchor) + off * ratio;
    else this.root.scrollTop = frac * this.root.scrollHeight;
    if (this.opts.onZoom) this.opts.onZoom(this.scale, this.mode);
  }

  setZoom(m) { this.mode = m; this.applyZoom(); }
  zoomBy(f) { this.setZoom(Math.round(Math.max(0.1, Math.min(6, this.scale * f)) * 100) / 100); }

  goTo(i) {
    if (!this.pages.length) return;
    i = Math.max(0, Math.min(this.pages.length - 1, i | 0));
    this.root.scrollTop = this.top(this.pages[i]) - 8;
    this.cur = i;
    if (this.opts.onPage) this.opts.onPage(i);
  }
  next() { this.goTo(this.cur + 1); }
  prev() { this.goTo(this.cur - 1); }

  trackPage() {
    if (!this.pages.length) return;
    const top = this.root.scrollTop + this.root.clientHeight * 0.3;
    let ans = 0;
    for (let i = 0; i < this.pages.length; i++) {
      if (this.top(this.pages[i]) <= top) ans = i; else break;
    }
    if (ans !== this.cur) { this.cur = ans; if (this.opts.onPage) this.opts.onPage(ans); }
  }

  search(q) { return this.finder.search(q); }
  findGo(d) { return this.finder.go(d); }
  clearSearch() { this.finder.clear(); }

  destroy() {
    this.ro.disconnect();
    this.root.removeEventListener('scroll', this.onScroll);
    this.finder.clear();
    if (this.opts.onDestroy) { try { this.opts.onDestroy(); } catch (_) {} }
    this.root.remove();
  }
}
