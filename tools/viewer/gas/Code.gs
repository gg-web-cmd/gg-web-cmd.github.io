/**
 * 문서 뷰어 — 구글 앱스 스크립트판
 *
 * 뷰어 화면은 GitHub Pages 의 문서 뷰어(https://gg-web-cmd.github.io/tools/viewer/)를 그대로 품고,
 * 구글 계정이 있어야 되는 두 가지만 여기서 해 준다.
 *   1) 메일 보내기 — 보고 있는 파일을 내 Gmail 계정으로 바로 첨부해 보낸다 (MailApp, 25MB 까지)
 *   2) 드라이브에서 열기 — 내 드라이브 파일을 찾아 뷰어로 연다 (구글 문서·시트·슬라이드는 PDF 로 바꿔서)
 *
 * 파일을 여는 일 자체는 사용자의 브라우저 안에서 일어난다. 이 스크립트는 파일을 저장하지 않는다.
 * 웹 앱은 "웹 앱에 액세스하는 사용자"로 실행되므로, 메일은 각자 자기 계정으로 나가고
 * 드라이브도 각자 자기 것만 보인다.
 */

/** 품을 뷰어 주소. 뷰어를 다른 곳에 두었으면 여기만 바꾸면 된다. */
var VIEWER_URL = 'https://gg-web-cmd.github.io/tools/viewer/';

/** 메일 첨부 한도 (Gmail 25MB, base64 로 늘어나는 것을 생각해 조금 낮게) */
var MAX_MAIL_BYTES = 24 * 1024 * 1024;
/** 드라이브에서 가져올 한도 (google.script.run 으로 넘길 수 있는 크기) */
var MAX_DRIVE_BYTES = 35 * 1024 * 1024;

function doGet() {
  var t = HtmlService.createTemplateFromFile('index');
  t.viewerUrl = VIEWER_URL;
  // 스크립트 안에 넣을 값은 미리 JSON 으로 (</script> 끊김 방지로 < 도 바꿔 둔다)
  t.viewerUrlJs = JSON.stringify(VIEWER_URL).replace(/</g, '\\u003c');
  t.emailJs = JSON.stringify(Session.getActiveUser().getEmail() || '').replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle('문서 뷰어')
    .setFaviconUrl(VIEWER_URL + 'icons/icon-192.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ------------------------------------------------------------------ 메일 */

/**
 * @param {{to:string, subject:string, body:string, name:string, mime:string, base64:string}} o
 * @return {{ok:boolean, remaining:number}}
 */
function sendMail(o) {
  if (!o || typeof o !== 'object') throw new Error('보낼 내용이 없습니다.');
  var to = String(o.to || '').trim();
  var list = to.split(/\s*,\s*/).filter(String);
  if (!list.length) throw new Error('받는 사람을 적어 주세요.');
  if (list.length > 20) throw new Error('한 번에 20명까지만 보낼 수 있습니다.');
  var re = /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/;
  for (var i = 0; i < list.length; i++) {
    if (!re.test(list[i])) throw new Error('메일 주소가 올바르지 않습니다: ' + list[i]);
  }
  var bytes = Utilities.base64Decode(String(o.base64 || ''));
  if (!bytes.length) throw new Error('첨부할 파일이 비었습니다.');
  if (bytes.length > MAX_MAIL_BYTES) throw new Error('메일에는 25MB 까지만 첨부할 수 있습니다.');
  var quota = MailApp.getRemainingDailyQuota();
  if (quota < list.length) throw new Error('오늘 보낼 수 있는 메일 수를 다 썼습니다. 내일 다시 해 주세요.');
  var name = String(o.name || '첨부파일').slice(0, 200);
  var blob = Utilities.newBlob(bytes, String(o.mime || 'application/octet-stream'), name);
  MailApp.sendEmail({
    to: list.join(','),
    subject: String(o.subject || name).slice(0, 250),
    body: String(o.body || '') + '\n\n— 문서 뷰어에서 보냄',
    attachments: [blob],
  });
  return { ok: true, remaining: MailApp.getRemainingDailyQuota() };
}

/* ------------------------------------------------------------------ 드라이브 */

var NATIVE = {
  'application/vnd.google-apps.document': true,
  'application/vnd.google-apps.spreadsheet': true,
  'application/vnd.google-apps.presentation': true,
  'application/vnd.google-apps.drawing': true,
};

/**
 * 내 드라이브 파일 목록 (최근 고친 순). query 가 있으면 이름으로 찾는다.
 * @return {{files: Array<Object>, next: ?string}}
 */
function listDriveFiles(query, pageToken) {
  var q = "trashed = false and mimeType != 'application/vnd.google-apps.folder'"
    + " and mimeType != 'application/vnd.google-apps.form' and mimeType != 'application/vnd.google-apps.shortcut'"
    + " and mimeType != 'application/vnd.google-apps.site' and mimeType != 'application/vnd.google-apps.map'";
  if (query) q += " and name contains '" + String(query).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  var res = Drive.Files.list({
    q: q,
    orderBy: query ? 'modifiedTime desc' : 'viewedByMeTime desc,modifiedTime desc',
    pageSize: 40,
    pageToken: pageToken || undefined,
    fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives',
  });
  var files = (res.files || []).map(function (f) {
    return { id: f.id, name: f.name, mime: f.mimeType, size: f.size || null, modified: f.modifiedTime, icon: f.iconLink || null, native: !!NATIVE[f.mimeType] };
  });
  return { files: files, next: res.nextPageToken || null };
}

/**
 * 파일 하나를 base64 로. 구글 문서·시트·슬라이드·그림은 PDF 로 바꿔 준다.
 * @return {{name:string, mime:string, base64:string}}
 */
function getDriveFile(fileId) {
  if (!/^[\w-]{10,}$/.test(String(fileId || ''))) throw new Error('파일 번호가 올바르지 않습니다.');
  var file = DriveApp.getFileById(fileId);
  var mime = file.getMimeType();
  var name = file.getName();
  var blob;
  if (NATIVE[mime]) {
    blob = file.getAs(MimeType.PDF);
    name = name.replace(/\.pdf$/i, '') + '.pdf';
  } else {
    if (file.getSize() > MAX_DRIVE_BYTES) throw new Error('35MB 보다 큰 파일은 드라이브에서 내려받아 열어 주세요.');
    blob = file.getBlob();
  }
  return { name: name, mime: blob.getContentType() || mime, base64: Utilities.base64Encode(blob.getBytes()) };
}
