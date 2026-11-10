# 문서 뷰어 (tools/viewer/)

한글(HWP·HWPX)·PDF·워드·엑셀·PPT·ODT·그림·마크다운·텍스트·ZIP 등 **거의 모든 문서를 설치 없이 보는** 웹앱.
편집은 하지 않는다. 보기·찾기·확대·인쇄·메일·내려받기만 한다.

- 주소: https://gg-web-cmd.github.io/tools/viewer/ (교실 도구함 메뉴: https://gg-web-cmd.github.io/tools/#viewer)
- 파일은 브라우저 안에서만 열린다. 서버로 올리지 않는다.
- 크롬·엣지에서 **앱으로 설치**하면 시작 메뉴에서 열리고, HWP·PDF 등을 "연결 프로그램"으로 고를 수 있다(`file_handlers`).
- 주소로 바로 열기: `?url=https://…/파일.pdf` (여러 번 줄 수 있음. 그 사이트가 CORS 를 허락해야 한다)
- 구글 앱스 스크립트판(내 Gmail 로 바로 첨부해 보내기 · 내 드라이브에서 열기): [`gas/`](gas/README.md)

## 형식별로 그리는 방법

| 형식 | 그리는 것 | 파일 |
| --- | --- | --- |
| HWP·HWPX·HWP 3.0·HML | `@rhwp/core` 0.8.7 (Rust→WASM 레이아웃 엔진)이 쪽마다 SVG 로 — 표·그림·수식·머리말·각주. 암호 문서 지원 | `js/r/hwp.js`, `js/hwp-engine.js` |
| PDF | pdf.js 5.7.284 (`../common/pdfjs`) — 캔버스 + 글자 층(선택·찾기) + 링크 층. 암호 PDF 지원 | `js/r/pdf.js` |
| DOCX | docx-preview 0.4.1 — 쪽 모양·머리말·각주 | `js/r/docx.js` |
| XLSX·XLS·ODS·CSV·TSV | SheetJS 0.18.5 — 시트 탭, 병합 칸, 열 너비, A·B·C / 1·2·3 머리글. CSV 는 CP949 자동 판별 | `js/r/sheet.js` |
| PPTX | pptx-preview 1.0.7 (jsDelivr 에서 받음 — npm 패키지는 무료 사용 허용, 저장소에 넣지 않음). 실패하면 슬라이드별 글·그림·메모 | `js/r/pptx.js` |
| ODT·ODP | 자체 변환(content.xml → HTML): 글자·문단 모양, 표 병합, 그림, 각주. 업무관리시스템 본문 .odt | `js/r/odf.js` |
| DOC·PPT·RTF (옛 형식) | 자체 추출: .doc 조각표(CLX)로 본문·표, .ppt 슬라이드 글 + Pictures 스트림 그림, RTF 글 | `js/r/legacy.js` |
| 그림 | 브라우저 기본 + HEIC(heic2any 0.0.4) + TIFF 여러 쪽(UTIF 3.1.0). 돌리기 | `js/r/image.js` |
| 마크다운·텍스트·코드·JSON | marked 15.0.12 + DOMPurify 3.2.6 + KaTeX 0.16.47(수식) + highlight.js 11.11.1. 인코딩 자동 판별·고르기 | `js/r/text.js` |
| HTML | DOMPurify 로 정리 + `sandbox`(스크립트 없음) + CSP | `js/r/text.js` |
| 주피터 노트북 | 마크다운·코드·출력(글·그림·표·오류) | `js/r/text.js` |
| EPUB | 차례 순서대로 장을 이어서 | `js/r/epub.js` |
| 소리·영상·글꼴·ZIP | `<audio>/<video>`, FontFace 미리보기, JSZip 3.10.1(한글 CP949 파일 이름) | `js/r/misc.js` |

형식은 확장자를 믿지 않고 **파일 앞부분 바이트**로 판별한다(`js/format.js`, `js/text-decode.js` —
`C:\vibe\ios-docviewer` 코어에서 가져옴).

## 구조

- `index.html` · `viewer.css` — 화면. 위 막대(쪽·확대·돌리기·찾기·인쇄·메일·내려받기·전체 화면·정보), 파일 목록, 첫 화면
- `js/app.js` — 열기(고르기·끌어 놓기·붙여 넣기·주소·앱 연결·드라이브) → 판별 → 렌더러, 인쇄·메일·구글 앱 연결
- `js/paged.js` — 쪽 문서(PDF·한글·그림) 공용 틀: 화면 가까운 쪽만 그리고 멀어지면 놓는다
- `js/flow.js` · `js/find.js` — 흐름 문서 틀과 찾기 강조(CSS Custom Highlight API)
- `sw.js` · `manifest.webmanifest` · `icons/` — 앱 설치·오프라인
- `lib/` — 위 라이브러리들 (각 폴더에 LICENSE)

## 인쇄

- 쪽 문서(PDF·한글·그림): 쪽마다 인쇄용으로 다시 그려(한글은 벡터 SVG, PDF 는 약 192dpi) 종이 한 장에 한 쪽씩
- 나머지: 화면의 내용을 그대로 (워드·ODT 는 여백 0, 표·슬라이드는 가로)

## 메일

- 웹판: 공유 창(Web Share, 기기 앱으로 파일 넘기기) · Gmail 쓰기 창 · 메일 프로그램. 웹 페이지는 메일에 파일을 직접 붙일 수 없어 파일을 먼저 내려받는다
- 구글 앱판: 내 Gmail 로 바로 첨부해 보낸다 (25MB 까지)

## 라이선스

| 라이브러리 | 판 | 라이선스 |
| --- | --- | --- |
| @rhwp/core | 0.8.7 | MIT |
| pdf.js | 5.7.284 | Apache-2.0 |
| docx-preview | 0.4.1 | Apache-2.0 |
| SheetJS (xlsx) | 0.18.5 | Apache-2.0 |
| JSZip | 3.10.1 | MIT 또는 GPLv3 (MIT 로 사용) |
| marked | 15.0.12 | MIT |
| DOMPurify | 3.2.6 | MPL-2.0 또는 Apache-2.0 |
| highlight.js | 11.11.1 | BSD-3-Clause |
| KaTeX | 0.16.47 | MIT |
| heic2any | 0.0.4 | MIT |
| UTIF.js | 3.1.0 | MIT |
| pptx-preview | 1.0.7 (CDN) | ISC — npm 패키지 무료 사용 허용 |

"한글", "HWP", "HWPX"는 한글과컴퓨터의 상표이며, 이 뷰어는 한글과컴퓨터와 관계가 없다.
