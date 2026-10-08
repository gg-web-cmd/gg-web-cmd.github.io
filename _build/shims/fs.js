/* 브라우저용 가짜 fs — 설치판 라이브러리가 부르는 몇 가지만 흉내 낸다.
 *
 * 설치판은 디스크의 파일 경로를 받아 fs 로 읽는다. 웹판에서는 사용자가 고른 File 을
 * 먼저 바이트로 읽어 이 안의 표(vfs)에 이름을 붙여 넣어 두고, 라이브러리에는 그 이름을 넘긴다.
 * 그러면 라이브러리는 자기가 디스크를 읽는 줄 안다 — 원본 코드를 한 줄도 안 고쳐도 된다.
 */
import { Buffer } from 'buffer';

const files = new Map();       // 이름 → Buffer
const fds = new Map();         // 번호 → 이름
let nextFd = 3;

function need(name) {
  const b = files.get(String(name));
  if (!b) {
    const e = new Error('ENOENT: ' + name);
    e.code = 'ENOENT';
    throw e;
  }
  return b;
}

export const vfs = {
  put(name, bytes) { files.set(String(name), Buffer.from(bytes)); return String(name); },
  drop(name) { files.delete(String(name)); },
  clear() { files.clear(); fds.clear(); },
  has(name) { return files.has(String(name)); },
};

export function existsSync(name) { return files.has(String(name)); }
export function readFileSync(name, enc) {
  const b = need(name);
  return enc ? b.toString(enc) : b;
}
export function statSync(name) {
  const b = need(name);
  return { size: b.length, mtimeMs: 0, isFile: () => true, isDirectory: () => false };
}
export function openSync(name) {
  need(name);
  const fd = nextFd++;
  fds.set(fd, String(name));
  return fd;
}
export function fstatSync(fd) { return statSync(fds.get(fd)); }
export function readSync(fd, buf, off, len, pos) {
  const b = need(fds.get(fd));
  const n = Math.max(0, Math.min(len, b.length - pos));
  b.copy(buf, off, pos, pos + n);
  return n;
}
export function closeSync(fd) { fds.delete(fd); }

function nope(name) {
  return () => { throw new Error('웹판에서는 ' + name + ' 를 쓸 수 없습니다'); };
}
export const writeFileSync = nope('writeFileSync');
export const mkdirSync = nope('mkdirSync');
export const renameSync = nope('renameSync');
export const readdirSync = nope('readdirSync');

export default {
  vfs, existsSync, readFileSync, statSync, openSync, fstatSync, readSync, closeSync,
  writeFileSync, mkdirSync, renameSync, readdirSync,
};
