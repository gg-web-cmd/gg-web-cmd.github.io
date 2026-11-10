# 문서 뷰어 — 구글 앱스 스크립트판

GitHub Pages 의 [문서 뷰어](https://gg-web-cmd.github.io/tools/viewer/)를 그대로 품고,
구글 계정이 있어야 되는 두 가지를 더한 웹 앱입니다.

| 웹판 (GitHub Pages) | 구글 앱판 (이 폴더) |
| --- | --- |
| 메일: 파일을 내려받고 Gmail·메일 프로그램 창만 열어 줌 (직접 첨부) | **내 Gmail 로 바로 첨부해 보냄** (25MB 까지) |
| 내 컴퓨터 파일만 | **내 구글 드라이브에서 열기** (구글 문서·시트·슬라이드는 PDF 로 바꿔서) |

뷰어 화면·형식 지원은 웹판과 똑같습니다(웹판을 고치면 앱판도 함께 바뀝니다). 파일을 여는 일은 브라우저 안에서 일어나고,
스크립트는 파일을 저장하지 않습니다. 웹 앱은 **접속한 사람의 계정으로** 실행되므로 메일은 각자 자기 계정으로 나가고,
드라이브도 각자 자기 것만 보입니다.

## 파일

- `Code.gs` — `doGet`(화면), `sendMail`(MailApp 으로 첨부 메일), `listDriveFiles`·`getDriveFile`(드라이브)
- `index.html` — 뷰어를 iframe 으로 품고, 뷰어와 `postMessage` 로 말을 주고받는 다리 (뷰어 출처만 받음)
- `appsscript.json` — 권한(드라이브 읽기 · 메일 보내기 · 내 메일 주소), 고급 Drive 서비스 v3, 웹 앱 설정

## 직접 올리는 법 (5분)

1. https://script.google.com 에서 **새 프로젝트** → 이름 `문서 뷰어`
2. 왼쪽 ⚙️ **프로젝트 설정** → "편집기에서 'appsscript.json' 매니페스트 파일 표시" 켜기
3. 편집기에서 `Code.gs`, `appsscript.json` 내용을 이 폴더의 것으로 바꾸고, ＋ → **HTML** → 이름 `index` 로 `index.html` 내용을 붙여 넣기
4. 💾 저장 → 오른쪽 위 **배포 → 새 배포** → 유형 **웹 앱**
   - 다음 사용자 인증 정보로 실행: **웹 앱에 액세스하는 사용자**
   - 액세스 권한: **Google 계정이 있는 모든 사용자** (학교 계정끼리만 쓰려면 "○○ 내 모든 사용자")
5. **배포** → 권한 승인 → 나온 `https://script.google.com/macros/s/…/exec` 주소가 앱 주소입니다

처음 여는 사람은 한 번 권한 승인 창이 뜹니다(드라이브 읽기·메일 보내기). 같은 학교 도메인 밖 계정이면
"확인되지 않은 앱" 안내가 나올 수 있는데, **고급 → (안전하지 않음)으로 이동** 을 눌러 계속하면 됩니다.

## clasp 로 올리는 법

```bash
npm i -g @google/clasp
clasp login
clasp create --type webapp --title "문서 뷰어" --rootDir .
clasp push -f
clasp deploy --description "문서 뷰어"
```

(https://script.google.com/home/usersettings 에서 "Google Apps Script API" 를 켜 두어야 합니다.)

## 고칠 때

- 뷰어 주소를 바꾸려면 `Code.gs` 의 `VIEWER_URL` 한 줄
- 뷰어(GitHub Pages)는 `?host=gas` 로 열리면 구글 앱 모드가 됩니다(드라이브 단추, 메일 바로 보내기). 연결 코드는 `../js/app.js` 의 `setupBridge`
- 뷰어 쪽 `GAS_URL` 상수에 배포 주소를 넣어 두면, 웹판 메일 창에 "구글 앱판 열기" 링크가 나옵니다
