# gg-web-cmd.github.io

바이브 코딩으로 만든 교실 웹앱과 연수 안내서 모음(사이트 홈).

- 홈: https://gg-web-cmd.github.io/
- 문서 뷰어: https://gg-web-cmd.github.io/tools/viewer/ — 한글(HWP·HWPX)·PDF·워드·엑셀·PPT·ODT·그림·마크다운·ZIP 등을 설치 없이 원본 모양대로 보기 (찾기·인쇄·메일, 앱 설치 시 파일 연결)
  (자세한 것은 [tools/viewer/README.md](tools/viewer/README.md), 구글 앱스 스크립트판은 [tools/viewer/gas/](tools/viewer/gas/README.md))
- 교실 도구함: https://gg-web-cmd.github.io/tools/ — 문서 뷰어 · PDF 쪽 편집 · PDF→사진 · 개인정보 지우개 · PPT 리스타일러 · 문서→MD 변환기 · 증명사진 · 명단 합치기 · 상장 · QR · 파일이름 일괄 바꾸기
  (윈도우 설치판 도구의 웹판. 자세한 것은 [tools/README.md](tools/README.md))
- 발명특허교실: https://gg-web-cmd.github.io/invention/ — 학생 발명 아이디어부터 명세서·특허 출원까지 8단계 안내
  (자세한 것은 [invention/README.md](invention/README.md))
- 사이언스 퀘스트 · 중2 과학: https://gg-web-cmd.github.io/science-quest/ — 중2 과학 여덟 단원을 연구소로 깨 나가는 픽셀 모험 게임
  (자세한 것은 [science-quest/README.md](science-quest/README.md))
- 그 밖의 앱은 별도 저장소의 GitHub Pages로 공개되어 있습니다.

## 2026-10-09 사용성 개선

- 홈과 교실 도구함에 검색 추가. 검색과 분류를 함께 적용하고 결과가 없을 때 안내합니다.
- `tools/rename/` 파일이름 일괄 바꾸기 웹판 추가: 번호, 접두·접미 문구, 찾아 바꾸기,
  파일 이름순 정렬, 미리보기, 중복/예약 이름 차단, 사본 ZIP 저장. 원본 파일은 수정하지 않습니다.
  한 번에 500개/250MB로 제한하며 설치판의 명단 맞춤·폴더 이름 변경은 제공하지 않습니다.
- AI 면접 도구와 짧은 주소 기능의 외부 전송 안내 보완.
- ZIP의 특수 파일 이름(`__proto__`, `constructor`) 처리 오류와 잘못된 주소 조각으로 도구함이 멈추는 문제 수정.

새 도구는 정적 파일만 사용하며 기존 GitHub Pages 배포에 포함됩니다.
- 파일이름 일괄 바꾸기: https://gg-web-cmd.github.io/tools/#rename
