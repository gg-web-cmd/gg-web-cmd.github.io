/* 글자 찾기 강조 — CSS Custom Highlight API 를 쓴다(문서 DOM 을 건드리지 않는다).
 * 지원하지 않는 브라우저에서는 강조 없이 위치로만 옮겨 간다. */

const registry = new Map();
const supported = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';

function refresh() {
  if (!supported) return;
  const all = [];
  registry.forEach((r) => all.push(...r));
  if (all.length) CSS.highlights.set('find', new Highlight(...all));
  else CSS.highlights.delete('find');
}

/** root 안 글자 마디에서 q 를 찾아 Range 목록을 만든다. */
export function findRanges(root, q) {
  const out = [];
  if (!root || !q) return out;
  const needle = q.toLocaleLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest('.pg-label, script, style')) return NodeFilter.FILTER_REJECT;
      return n.nodeValue && n.nodeValue.length >= needle.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  let n;
  while ((n = walker.nextNode())) {
    const hay = n.nodeValue.toLocaleLowerCase();
    let i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) {
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + needle.length);
      out.push(r);
      i += needle.length;
    }
  }
  return out;
}

export function highlightText(root, q, key) {
  const ranges = findRanges(root, q);
  registry.set(key || 'main', ranges);
  refresh();
  return ranges;
}

export function setCurrent(range) {
  if (!supported) return;
  if (range) CSS.highlights.set('find-cur', new Highlight(range));
  else CSS.highlights.delete('find-cur');
}

export function clearHighlight() {
  registry.clear();
  if (supported) { CSS.highlights.delete('find'); CSS.highlights.delete('find-cur'); }
}

/** 쪽 없이 이어지는 문서(워드·마크다운·표·텍스트)용 찾기. */
export class FlowFinder {
  constructor(root) { this.root = root; this.ranges = []; this.idx = -1; }
  search(q) {
    clearHighlight();
    this.ranges = q ? highlightText(this.root, q, 'flow') : [];
    this.idx = -1;
    return this.ranges.length;
  }
  go(delta) {
    if (!this.ranges.length) return 0;
    this.idx = (this.idx + delta + this.ranges.length) % this.ranges.length;
    const r = this.ranges[this.idx];
    setCurrent(r);
    const host = r.startContainer.parentElement;
    if (host) host.scrollIntoView({ block: 'center', inline: 'nearest' });
    return this.idx + 1;
  }
  clear() { clearHighlight(); this.ranges = []; this.idx = -1; }
}
