/* 그림 — JPG·PNG·GIF·WEBP·BMP·AVIF·ICO·SVG 는 브라우저가 바로,
 * HEIC(아이폰 사진)는 heic2any, TIFF(여러 쪽 팩스 포함)는 UTIF 로 풀어서 보여 준다. */
import { PagedView } from '../paged.js';
import { libs, el, extOf } from '../util.js';

function loadImg(url) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('이 브라우저가 이 그림 형식을 열지 못합니다.'));
    im.src = url;
  });
}

function sniffMime(b, ext) {
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return 'image/webp';
  if (ext === 'svg' || ext === 'svgz') return 'image/svg+xml';
  if (ext === 'ico' || ext === 'cur') return 'image/x-icon';
  const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
  if (/avif|avis/.test(brand)) return 'image/avif';
  if (/hei|hev|mif1|msf1/.test(brand)) return 'image/heic';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) return 'image/tiff';
  return 'application/octet-stream';
}

async function tiffPages(bytes) {
  const UTIF = await libs.utif();
  const buf = bytes.slice().buffer;
  const ifds = UTIF.decode(buf).filter((d) => d.t256 && d.t257);
  return ifds.map((ifd) => ({
    w: ifd.t256[0], h: ifd.t257[0],
    async url() {
      UTIF.decodeImage(buf, ifd);
      const rgba = UTIF.toRGBA8(ifd);
      const cv = document.createElement('canvas');
      cv.width = ifd.width; cv.height = ifd.height;
      cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer), ifd.width, ifd.height), 0, 0);
      ifd.data = null;
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      cv.width = 0;
      return URL.createObjectURL(blob);
    },
  }));
}

export async function render(doc, container, ctx) {
  const ext = extOf(doc.name);
  const mime = sniffMime(doc.bytes, ext);
  const info = [];
  const urls = [];
  let pages; // [{w, h, url: () => Promise<string>}]

  if (mime === 'image/tiff') {
    ctx.progress('TIFF 그림을 푸는 중…');
    pages = await tiffPages(doc.bytes);
    if (!pages.length) throw new Error('TIFF 안에서 그림을 찾지 못했습니다.');
    info.push(['형식', 'TIFF' + (pages.length > 1 ? ` (${pages.length}쪽)` : '')]);
  } else {
    let blob = new Blob([doc.bytes], { type: mime });
    if (mime === 'image/heic') {
      const nativeUrl = URL.createObjectURL(blob);
      try { await loadImg(nativeUrl); } // 사파리는 HEIC 를 바로 연다
      catch (_) {
        ctx.progress('아이폰 사진(HEIC)을 바꾸는 중… 몇 초 걸립니다');
        const h2a = await libs.heic();
        const out = await h2a({ blob, toType: 'image/jpeg', quality: 0.92 });
        blob = Array.isArray(out) ? out[0] : out;
      }
      URL.revokeObjectURL(nativeUrl);
      info.push(['형식', 'HEIC (아이폰 사진)']);
    } else {
      info.push(['형식', mime.replace('image/', '').toUpperCase()]);
    }
    const url = URL.createObjectURL(blob);
    urls.push(url);
    const im = await loadImg(url);
    const w = im.naturalWidth || 800, h = im.naturalHeight || 600;
    pages = [{ w, h, url: async () => url }];
  }
  info.unshift(['크기', pages.map((p) => `${p.w} × ${p.h} px`).slice(0, 3).join(', ') + (pages.length > 3 ? ' …' : '')]);

  const pageUrls = new Map();
  const getUrl = async (i) => {
    if (!pageUrls.has(i)) pageUrls.set(i, pages[i].url());
    return pageUrls.get(i);
  };

  const src = {
    pageCount: pages.length,
    rotatable: true,
    pageSize: (i) => ({ w: pages[i].w, h: pages[i].h }),
    async render(i, box, scale, rot) {
      const url = await getUrl(i);
      let img = box.querySelector('img.pic');
      if (!img) {
        img = el('img', { class: 'pic', src: url, alt: doc.name, draggable: 'false' });
        box.appendChild(img);
      }
      const w = pages[i].w * scale, h = pages[i].h * scale;
      img.style.width = w + 'px';
      img.style.height = h + 'px';
      img.style.transform = rot ? `translate(-50%, -50%) rotate(${rot}deg)` : '';
      img.classList.toggle('rotated', !!rot);
    },
    resize(i, box, scale) {
      const img = box.querySelector('img.pic');
      if (!img) return;
      img.style.width = pages[i].w * scale + 'px';
      img.style.height = pages[i].h * scale + 'px';
    },
    async printPage(i, rot) {
      const url = await getUrl(i);
      if (!rot) return el('img', { src: url, alt: '' });
      const im = await loadImg(url);
      const cv = document.createElement('canvas');
      const sw = rot % 180 ? im.naturalHeight : im.naturalWidth, sh = rot % 180 ? im.naturalWidth : im.naturalHeight;
      cv.width = sw; cv.height = sh;
      const c = cv.getContext('2d');
      c.translate(sw / 2, sh / 2); c.rotate(rot * Math.PI / 180);
      c.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      return el('img', { src: URL.createObjectURL(blob), alt: '' });
    },
    destroy() {
      urls.forEach((u) => URL.revokeObjectURL(u));
      pageUrls.forEach((p) => p.then((u) => URL.revokeObjectURL(u)).catch(() => {}));
    },
  };
  const view = new PagedView(container, src, ctx.pagedOpts({ zoom: 'fit', className: 'image-view' }));
  view.root.classList.add('image-view');
  return { paged: view, info };
}
