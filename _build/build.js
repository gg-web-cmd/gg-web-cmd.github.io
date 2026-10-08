/* 교실 도구함 웹판 — 설치판의 Node 라이브러리를 브라우저용 한 파일로 묶는다.
 *
 *   cd _build && npm install && npm run build
 *
 * 설치판 원본은 C:\vibe\<도구>\lib 에 있고 (이 저장소 바로 바깥), 여기서는 **읽기만** 한다.
 * 원본을 베껴 고치지 않는 까닭: 설치판의 자체 점검(--selftest)을 통과한 계산을
 * 웹판도 그대로 쓰게 하려는 것이다. 베껴 두면 언젠가 한쪽만 고쳐진다.
 *
 * fs · zlib · path · os 는 shims\ 의 가짜로 바꿔 끼운다.
 *   fs   — 사용자가 고른 파일을 먼저 vfs 에 넣어 두고, 라이브러리에는 그 이름을 준다
 *   zlib — 엑셀(xlsx) 읽기·쓰기에 필요한 raw deflate 만 (fflate)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const VIBE = path.resolve(__dirname, '..', '..');          // C:\vibe
const TOOLS = path.resolve(__dirname, '..', 'tools');
const SHIM = (n) => path.join(__dirname, 'shims', n);

/* 묶을 것: 어느 도구 폴더에, 어떤 전역 이름으로, 무엇을 담을지 */
const TARGETS = [
  {
    out: path.join(TOOLS, 'idphoto', 'js', 'nodelibs.js'),
    global: 'NodeLibs',
    modules: {
      roster: path.join(VIBE, '증명사진만들기', 'lib', 'roster.js'),
      photos: path.join(VIBE, '증명사진만들기', 'lib', 'photos.js'),
    },
  },
  {
    out: path.join(TOOLS, 'roster', 'js', 'nodelibs.js'),
    global: 'NodeLibs',
    modules: {
      roster: path.join(VIBE, '명단합치기', 'lib', 'roster.js'),
      sheets: path.join(VIBE, '명단합치기', 'lib', 'sheets.js'),
      merge: path.join(VIBE, '명단합치기', 'lib', 'merge.js'),
    },
  },
];

async function main() {
  for (const t of TARGETS) {
    const lines = ["import { vfs } from 'fs';", "import { Buffer } from 'buffer';", 'export { vfs, Buffer };'];
    for (const [name, file] of Object.entries(t.modules)) {
      if (!fs.existsSync(file)) throw new Error('원본이 없습니다: ' + file);
      lines.push(`export const ${name} = require(${JSON.stringify(file.replace(/\\/g, '/'))});`);
    }
    fs.mkdirSync(path.dirname(t.out), { recursive: true });
    await esbuild.build({
      stdin: { contents: lines.join('\n'), resolveDir: __dirname, sourcefile: 'entry.js', loader: 'js' },
      bundle: true,
      format: 'iife',
      globalName: t.global,
      platform: 'browser',
      target: ['chrome100', 'firefox100', 'safari15'],
      outfile: t.out,
      alias: { fs: SHIM('fs.js'), zlib: SHIM('zlib.js'), path: SHIM('path.js'), os: SHIM('os.js') },
      inject: [SHIM('buffer-global.js')],
      define: { 'process.env': '{}', 'process.platform': '"browser"' },
      banner: { js: '/* 자동 생성 파일 — 고치지 마세요. _build/build.js 가 설치판 lib 를 묶어 만듭니다. */' },
      legalComments: 'none',
      logLevel: 'warning',
    });
    console.log('묶음 →', path.relative(path.resolve(__dirname, '..'), t.out), (fs.statSync(t.out).size / 1024).toFixed(0) + 'KB');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
