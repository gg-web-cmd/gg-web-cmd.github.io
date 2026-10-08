# 교실 도구함 (tools/)

`C:\vibe` 의 윈도우 설치형 도구(OS웹) 가운데 **브라우저만으로 돌 수 있는 것**을 골라
메뉴 하나에 모은 웹판. 주소: https://gg-web-cmd.github.io/tools/

모든 처리는 브라우저 안에서 일어나고 파일은 어디로도 올라가지 않는다.

| 메뉴 | 폴더 | 설치판 원본 | 웹판에서 달라진 것 |
| --- | --- | --- | --- |
| PDF 쪽 편집 | `pdf-pages/` | (새로 만듦) | 합치기·나누기·돌리기·빼기·순서·사진→PDF (pdf-lib) |
| PDF → 사진 | `pdf-jpg/` | `PDF이미지변환기` | 저장은 ZIP 또는 고른 폴더(크롬·엣지) |
| 증명사진 만들기 | `idphoto/` | `증명사진만들기` | 폴더·사진 고르기/끌어 놓기, ZIP 또는 폴더 저장, 명단은 저장 안 함 |
| 명단 합치기 | `roster/` | `명단합치기` | 결과 엑셀/CSV 를 내려받기 |
| 화면 녹화 | `recorder/` | `화면녹화기` | 폴더에 바로 쓰기 또는 끝나면 내려받기. 빨간 테두리·전역 단축키 없음 |
| 개인정보 지우개 | `privacy/` | `개인정보지우개` | 원본은 안 고치고 가린 **사본**을 ZIP 으로 (그래서 되돌리기·격리 없음) |
| PPT 리스타일러 | `ppt/` | `ppt` | 디자인 목록은 빌드 때 `designs.json` 으로 굳힘 |
| 상장 만들기 | `award/` | `award` (파이썬) | 캔버스로 다시 씀. 맑은 고딕 없으면 Noto Sans KR |
| QR · 짧은 주소 | `qr/` | `url-qr` (파이썬) | da.gd·is.gd·v.gd 만 (브라우저에서 부를 수 있는 곳) |

## 구조

- `index.html` — 메뉴 셸. 도구마다 iframe 하나, 처음 열 때 만들고 옮겨 가도 지우지 않는다
  (하던 일이 남는다). 새 도구는 `TOOLS` 에 한 줄 더하면 메뉴·첫 화면에 나온다.
- `common/` — 함께 쓰는 것: `theme.js`(밝기·메뉴 안 여부), `zip.js`(STORE ZIP 만들기·내려받기),
  `app.css`(PDF 도구 겉모습), `pdfjs/`(pdf.js 5.7.284), `pdf-lib/`(1.17.1), `qrcode/`(qrcode-generator 1.4.4).
- 설치판의 서버 자리는 각 도구의 `js/local-api.js` · `js/local-server.js` 가 대신한다.
  화면 코드(`app.js`)는 설치판과 거의 같다 — `api('/api/…')` 길목만 브라우저 안으로 돌렸다.

## 설치판 라이브러리 묶기 (`_build/`)

증명사진·명단 합치기·개인정보 지우개·PPT 리스타일러의 계산은 설치판 `lib/*.js` 를
**고치지 않고** esbuild 로 묶어 `js/nodelibs.js` 로 쓴다. `fs`·`zlib`·`path`·`os` 는
`_build/shims/` 의 가짜로 바꿔 끼운다(사용자가 고른 파일을 가짜 fs 에 넣어 두고 이름을 넘긴다).

```
cd _build
npm install
npm run build
```

설치판 원본(`C:\vibe\증명사진만들기\lib`, `C:\vibe\명단합치기\lib`)을 고쳤으면 다시 묶어야 한다.
