/* 한글 HWP·HWPX·HWP 3.0·HML — @rhwp/core (Rust+WASM, MIT) 레이아웃 엔진.
 * 쪽 나눔까지 엔진이 계산하고, 쪽마다 벡터 SVG 를 받아 그대로 넣는다.
 * 글자는 SVG <text> 라서 선택·복사가 되고, 인쇄도 벡터로 나간다. */
import { PagedView } from '../paged.js';
import { initEngine, HwpFile } from '../hwp-engine.js';
import { libs } from '../util.js';

let svgSeq = 0;

/** 쪽 SVG 를 넣기 좋게: 아이디가 다른 쪽과 겹치지 않게 접두를 붙이고 위험한 것을 걷어낸다. */
async function cleanSvg(svg) {
  const p = 'h' + (++svgSeq) + '-';
  const prefixed = svg
    .replace(/\bid="([^"]+)"/g, (m, id) => `id="${p}${id}"`)
    .replace(/url\((['"]?)#([^)'"]+)\1\)/g, (m, q, id) => `url(${q}#${p}${id}${q})`)
    .replace(/((?:xlink:)?href)="#([^"]+)"/g, (m, a, id) => `${a}="#${p}${id}"`);
  const P = await libs.purify();
  return P.sanitize(prefixed, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use', 'clipPath'],
    ADD_ATTR: ['xlink:href', 'href', 'clip-path', 'clipPathUnits', 'preserveAspectRatio', 'xml:space', 'text-decoration', 'letter-spacing', 'word-spacing', 'font-feature-settings'],
    FORBID_TAGS: ['script', 'a', 'foreignObject'],
    WHOLE_DOCUMENT: false,
  });
}

function svgNode(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content.querySelector('svg');
}

export async function render(doc, container, ctx) {
  ctx.progress('한글 엔진을 준비하는 중… (처음 한 번만 약 12MB 를 받습니다)');
  await Promise.all([initEngine(), libs.purify()]);
  ctx.progress('한글 문서를 읽는 중…');

  let hwp = null;
  try {
    hwp = new HwpFile(doc.bytes, { pageCacheSize: 4 });
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/암호|password|encrypt|distribut/i.test(msg)) {
      let tip = '이 한글 문서는 암호로 잠겨 있습니다.';
      for (;;) {
        const pw = await ctx.askPassword(tip);
        if (pw == null) throw new Error('암호를 넣지 않아 열지 않았습니다.');
        try { hwp = new HwpFile(doc.bytes, { pageCacheSize: 4, password: pw }); break; }
        catch (_) { tip = '암호가 맞지 않습니다. 다시 넣어 주세요.'; }
      }
    } else {
      throw new Error('한글 문서를 읽지 못했습니다. 손상되었거나 엔진이 아직 모르는 구조입니다. (' + msg.slice(0, 120) + ')');
    }
  }

  const n = hwp.pageCount;
  if (!n) throw new Error('쪽이 하나도 없는 문서입니다.');
  const sizes = [];
  for (let i = 0; i < n; i++) {
    const pi = hwp.pageInfo(i);
    sizes.push(pi && pi.width ? { w: pi.width, h: pi.height } : (sizes[i - 1] || { w: 793.7, h: 1122.5 }));
  }

  const svgCache = new Map(); // 정리한 SVG 문자열 몇 장
  async function pageSvg(i) {
    if (svgCache.has(i)) return svgCache.get(i);
    const clean = await cleanSvg(hwp.renderPageSvg(i));
    svgCache.set(i, clean);
    if (svgCache.size > 8) svgCache.delete(svgCache.keys().next().value);
    return clean;
  }

  const src = {
    pageCount: n,
    rotatable: false,
    pageSize: (i) => sizes[i],
    async render(i, box, scale) {
      const w = Math.round(sizes[i].w * scale), h = Math.round(sizes[i].h * scale);
      let svg = box.querySelector('svg.hwp-svg');
      if (!svg) {
        svg = svgNode(await pageSvg(i));
        if (!svg) throw new Error('쪽 그림이 비었습니다');
        svg.classList.add('hwp-svg');
        box.appendChild(svg);
      }
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
    },
    pageText: async (i) => hwp.pageText(i),
    async printPage(i) {
      const svg = svgNode(await pageSvg(i));
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      return svg;
    },
    destroy() { svgCache.clear(); hwp.close(); },
  };

  const view = new PagedView(container, src, ctx.pagedOpts({ zoom: 'auto' }));

  const info = [['쪽 수', n + '쪽']];
  const s0 = sizes[0];
  info.push(['쪽 크기', `${Math.round(s0.w / 96 * 25.4)} × ${Math.round(s0.h / 96 * 25.4)} mm`]);
  const fmt = hwp.sourceFormat;
  if (fmt && fmt !== 'unknown') info.push(['원본 형식', String(fmt).toUpperCase()]);
  const di = hwp.info;
  if (di.version) info.push(['한글 문서 판', di.version]);
  if (di.fontsUsed && di.fontsUsed.length) info.push(['쓰인 글꼴', di.fontsUsed.slice(0, 12).join(', ') + (di.fontsUsed.length > 12 ? ' …' : '')]);
  if (hwp.warningCount) info.push(['주의', `엔진이 ${hwp.warningCount}곳을 완전히 해석하지 못해 원본과 조금 다를 수 있습니다.`]);
  info.push(['글꼴', '이 컴퓨터에 원본 글꼴(함초롬 등)이 없으면 비슷한 글꼴로 보여 줍니다.']);
  return { paged: view, info };
}
