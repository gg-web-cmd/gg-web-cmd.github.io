/* 소리·영상·글꼴·압축 파일·알 수 없는 파일 */
import { FlowView } from '../flow.js';
import { libs, el, extOf, formatSize, downloadBlob } from '../util.js';

/* ------------------------------------------------------------------ 소리·영상 */

const MEDIA_MIME = {
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac',
  flac: 'audio/flac', opus: 'audio/ogg', weba: 'audio/webm', wma: 'audio/x-ms-wma', amr: 'audio/amr',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', '3gp': 'video/3gpp',
};

export function mediaKind(ext) {
  const m = MEDIA_MIME[ext];
  return m ? m.split('/')[0] : null;
}

export async function renderMedia(doc, container, ctx) {
  const ext = extOf(doc.name);
  const mime = MEDIA_MIME[ext] || doc.type || '';
  const isVideo = mime.startsWith('video');
  const url = URL.createObjectURL(new Blob([doc.bytes], { type: mime }));
  const view = new FlowView(container, ctx.flowOpts({ className: 'media-flow', zoom: 1 }));
  const player = el(isVideo ? 'video' : 'audio', { src: url, controls: true, preload: 'metadata', class: 'media' });
  const msg = el('p', { class: 'media-msg' });
  view.content.append(isVideo ? player : el('div', { class: 'audio-card' }, el('div', { class: 'audio-ic', text: '🎵' }), el('b', { text: doc.name }), player), msg);
  const info = [['형식', mime || ext]];
  await new Promise((res) => {
    player.addEventListener('loadedmetadata', () => {
      const d = player.duration;
      if (isFinite(d)) info.push(['길이', `${Math.floor(d / 60)}분 ${Math.round(d % 60)}초`]);
      if (isVideo && player.videoWidth) info.push(['화면 크기', `${player.videoWidth} × ${player.videoHeight}`]);
      res();
    }, { once: true });
    player.addEventListener('error', () => {
      msg.textContent = '이 브라우저가 이 파일의 압축 방식(코덱)을 재생하지 못합니다. 내려받아 컴퓨터의 재생 프로그램으로 열어 주세요.';
      res();
    }, { once: true });
    setTimeout(res, 4000);
  });
  view.ready();
  return { flow: view, info, onDestroy() { player.pause(); URL.revokeObjectURL(url); }, noPrint: true };
}

/* ------------------------------------------------------------------ 글꼴 */

export async function renderFont(doc, container, ctx) {
  const fam = 'viewer-font-' + Math.random().toString(36).slice(2, 8);
  const face = new FontFace(fam, doc.bytes.slice().buffer);
  try { await face.load(); } catch (_) { throw new Error('글꼴 파일을 읽지 못했습니다.'); }
  document.fonts.add(face);
  const view = new FlowView(container, ctx.flowOpts({ className: 'font-flow', zoom: 1 }));
  const style = { fontFamily: `"${fam}"` };
  const sample = el('div', { class: 'font-sample' });
  const input = el('input', { type: 'text', value: '다람쥐 헌 쳇바퀴에 타고파 The quick brown fox 0123456789', 'aria-label': '보기 글' });
  const sizes = [12, 16, 24, 36, 48, 72];
  function paint() {
    sample.innerHTML = '';
    for (const s of sizes) sample.appendChild(el('div', { class: 'font-line', style: Object.assign({ fontSize: s + 'px' }, style) }, el('small', { text: s + 'px' }), input.value));
  }
  input.addEventListener('input', paint);
  paint();
  const glyphs = el('div', { class: 'font-glyphs', style },
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 !?.,:;\'"()[]{}@#$%&*+-=/\n가나다라마바사아자차카타파하 ㄱㄴㄷㄹ ㅏㅑㅓㅕ\n한글 글꼴 미리보기 — 大韓民國 漢字');
  view.content.append(el('h2', { style, text: doc.name.replace(/\.[^.]+$/, '') }), el('label', { class: 'font-input' }, '보기 글 바꾸기 ', input), sample, glyphs);
  view.ready();
  return { flow: view, info: [['글꼴 형식', extOf(doc.name).toUpperCase()]], onDestroy() { document.fonts.delete(face); } };
}

/* ------------------------------------------------------------------ 압축 파일 */

function decodeName(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
  catch (_) { try { return new TextDecoder('euc-kr').decode(b); } catch (__) { return new TextDecoder().decode(b); } }
}

const PREVIEWS = ['QuickLook/Preview.pdf', 'preview.jpg', 'QuickLook/Thumbnail.jpg', 'preview-web.jpg', 'Preview.png', 'Thumbnails/thumbnail.png'];

export async function renderZip(doc, container, ctx) {
  ctx.progress('압축 파일 목록을 읽는 중…');
  const JSZip = await libs.jszip();
  let zip;
  try { zip = await JSZip.loadAsync(doc.bytes, { decodeFileName: decodeName }); }
  catch (e) { throw new Error('압축 파일을 열지 못했습니다 (암호가 걸렸거나 ZIP 이 아닌 압축 방식일 수 있습니다): ' + e.message); }
  const entries = Object.values(zip.files).filter((f) => !f.dir && !/^__MACOSX\//.test(f.name) && !/(^|\/)\.DS_Store$/.test(f.name));
  entries.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const view = new FlowView(container, ctx.flowOpts({ className: 'zip-flow', zoom: 1 }));

  // 애플 Pages·Numbers·Keynote 는 안에 미리보기 그림이 들어 있다
  const iwork = ['pages', 'numbers', 'keynote'].includes(doc.kind);
  if (iwork) {
    const pv = PREVIEWS.map((p) => zip.file(p)).find(Boolean);
    const box = el('div', { class: 'iwork-preview' });
    if (pv && /\.pdf$/i.test(pv.name)) {
      const bytes = await pv.async('uint8array');
      box.append(el('p', { text: '애플 문서 안에 들어 있는 미리보기 PDF 가 있습니다.' }),
        el('button', { type: 'button', class: 'btn primary', onclick: () => ctx.openChild({ name: doc.name.replace(/\.\w+$/, '') + ' (미리보기).pdf', bytes }) }, '미리보기 PDF 열기'));
    } else if (pv) {
      const blob = await pv.async('blob');
      box.append(el('p', { text: '애플 문서 안에 들어 있는 첫 쪽 미리보기입니다. 전체 내용은 Pages·Numbers·Keynote 에서 PDF 로 내보내 열어 주세요.' }),
        el('img', { src: URL.createObjectURL(blob), alt: '미리보기' }));
    } else {
      box.append(el('p', { text: '이 애플 문서에는 미리보기가 들어 있지 않습니다. Pages·Numbers·Keynote 에서 PDF 로 내보내 열어 주세요.' }));
    }
    view.content.appendChild(box);
  }

  const total = entries.reduce((s, f) => s + ((f._data && f._data.uncompressedSize) || 0), 0);
  const table = el('table', { class: 'zip-table' },
    el('thead', null, el('tr', null, el('th', { text: '이름' }), el('th', { text: '크기' }), el('th', { text: '날짜' }), el('th', { text: '' }))));
  const tb = el('tbody');
  for (const f of entries.slice(0, 5000)) {
    const size = f._data && f._data.uncompressedSize;
    const parts = f.name.split('/');
    const base = parts.pop();
    const open = async () => {
      ctx.progress(base + ' 을(를) 꺼내는 중…');
      try { ctx.openChild({ name: base, bytes: await f.async('uint8array'), date: f.date }); }
      finally { ctx.progress(null); }
    };
    tb.appendChild(el('tr', null,
      el('td', { class: 'zip-name' }, parts.length ? el('span', { class: 'zip-dir', text: parts.join('/') + '/' }) : null,
        el('a', { href: '#', onclick: (e) => { e.preventDefault(); open(); } }, base)),
      el('td', { class: 'num', text: size != null ? formatSize(size) : '' }),
      el('td', { text: f.date ? f.date.toLocaleDateString('ko-KR') : '' }),
      el('td', { class: 'zip-act' },
        el('button', { type: 'button', class: 'btn small', onclick: open }, '보기'),
        el('button', { type: 'button', class: 'btn small', title: '이 파일만 내려받기', onclick: async () => downloadBlob(await f.async('blob'), base) }, '⬇'))));
  }
  table.appendChild(tb);
  view.content.append(el('h3', { class: 'zip-h', text: `안에 든 파일 ${entries.length.toLocaleString()}개 · 풀면 ${formatSize(total)}` }), table);
  view.ready();
  return { flow: view, info: [['안에 든 파일', entries.length + '개'], ['풀면', formatSize(total)]] };
}

/* ------------------------------------------------------------------ 알 수 없는 파일 */

export async function renderUnknown(doc, container, ctx) {
  const view = new FlowView(container, ctx.flowOpts({ className: 'unknown-flow', zoom: 1 }));
  const b = doc.bytes.subarray(0, 2048);
  const lines = [];
  for (let i = 0; i < b.length; i += 16) {
    const row = b.subarray(i, i + 16);
    const hex = [...row].map((x) => x.toString(16).padStart(2, '0')).join(' ');
    const asc = [...row].map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '.')).join('');
    lines.push(i.toString(16).padStart(6, '0') + '  ' + hex.padEnd(48) + '  ' + asc);
  }
  const ext = extOf(doc.name);
  const tips = {
    hwt: '한글 서식 파일(.hwt)은 한글 프로그램에서 열어 주세요.',
    alz: '알집(.alz) 압축은 브라우저에서 풀 수 없습니다. 반디집 등으로 풀어 주세요.',
    egg: '알집(.egg) 압축은 브라우저에서 풀 수 없습니다. 반디집 등으로 풀어 주세요.',
    rar: 'RAR 압축은 브라우저에서 풀 수 없습니다. 반디집 등으로 풀어 주세요.',
    '7z': '7z 압축은 브라우저에서 풀 수 없습니다. 반디집 등으로 풀어 주세요.',
    exe: '프로그램 파일(.exe)은 보기 대상이 아닙니다.',
  };
  view.content.append(
    el('div', { class: 'unknown-card' },
      el('h2', { text: '이 파일은 미리 볼 수 없는 형식입니다' }),
      el('p', { text: tips[ext] || (doc.reason ? `판별 근거: ${doc.reason}. ` : '') + '내려받아 알맞은 프로그램으로 열거나, 아래 단추로 글자로 열어 볼 수 있습니다.' }),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn', onclick: () => ctx.reopenAs('text') }, '글자로 열어 보기'),
        el('button', { type: 'button', class: 'btn', onclick: () => downloadBlob(new Blob([doc.bytes]), doc.name) }, '내려받기'))),
    el('h3', { text: '앞부분 바이트 (16진수)' }),
    el('pre', { class: 'hex', text: lines.join('\n') }));
  view.ready();
  return { flow: view, info: [], noPrint: true };
}
