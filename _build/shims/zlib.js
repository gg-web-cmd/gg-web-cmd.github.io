/* 브라우저용 가짜 zlib — 엑셀(xlsx) 읽고 쓰기에 필요한 raw deflate 두 가지만. */
import { inflateSync, deflateSync } from 'fflate';
import { Buffer } from 'buffer';

export function inflateRawSync(buf, opts) {
  const out = inflateSync(new Uint8Array(buf.buffer, buf.byteOffset, buf.length));
  if (opts && opts.maxOutputLength && out.length > opts.maxOutputLength) throw new Error('너무 큽니다');
  return Buffer.from(out);
}
export function deflateRawSync(buf, opts) {
  const level = opts && opts.level != null ? opts.level : 6;
  return Buffer.from(deflateSync(new Uint8Array(buf.buffer, buf.byteOffset, buf.length), { level }));
}
export default { inflateRawSync, deflateRawSync };
