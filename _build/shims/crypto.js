/* 브라우저용 가짜 crypto — 라이브러리가 불러만 두고 웹판에서는 쓰지 않는다. */
module.exports = {
  randomBytes(n) { const b = new Uint8Array(n); globalThis.crypto.getRandomValues(b); return Buffer.from(b); },
};
