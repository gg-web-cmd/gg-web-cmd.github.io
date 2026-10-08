/* 브라우저용 가짜 path — 라이브러리가 불러만 두고 웹판에서는 거의 안 쓴다. */
function basename(p, ext) {
  let b = String(p).split(/[\/]/).pop();
  if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length);
  return b;
}
function dirname(p) {
  const parts = String(p).split(/[\/]/);
  parts.pop();
  return parts.join('/') || '.';
}
function extname(p) {
  const m = /\.[^.\/]*$/.exec(basename(p));
  return m ? m[0] : '';
}
function join(...a) { return a.filter((x) => x !== '' && x != null).join('/').replace(/\/+/g, '/'); }
const path = { basename, dirname, extname, join, resolve: join, normalize: String, sep: '/' };
path.posix = path;
path.win32 = path;
module.exports = path;
