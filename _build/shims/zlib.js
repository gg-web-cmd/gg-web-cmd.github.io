/* 브라우저용 가짜 zlib — 문서(zip·hwp) 읽고 쓰기에 필요한 deflate 몇 가지만 (fflate). */
import { inflateSync as rawInflate, deflateSync as rawDeflate, unzlibSync, zlibSync } from 'fflate';
import { Buffer } from 'buffer';

const u8 = (buf) => new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
function cap(out, opts) {
  if (opts && opts.maxOutputLength && out.length > opts.maxOutputLength) throw new Error('너무 큽니다');
  return Buffer.from(out);
}

export function inflateRawSync(buf, opts) { return cap(rawInflate(u8(buf)), opts); }
export function deflateRawSync(buf, opts) {
  return Buffer.from(rawDeflate(u8(buf), { level: opts && opts.level != null ? opts.level : 6 }));
}
export function inflateSync(buf, opts) { return cap(unzlibSync(u8(buf)), opts); }
export function deflateSync(buf, opts) {
  return Buffer.from(zlibSync(u8(buf), { level: opts && opts.level != null ? opts.level : 6 }));
}
export default { inflateRawSync, deflateRawSync, inflateSync, deflateSync };
