/* 문서 뷰어 서비스 워커 — 한 번 열어 둔 뒤에는 인터넷이 끊겨도 뷰어가 열리게.
 *  · 뷰어 자체(html·css·js): 네트워크 먼저, 안 되면 저장본 → 고치면 바로 반영된다
 *  · 라이브러리(lib/·../common/pdfjs/): 저장본 먼저 → 판 번호가 붙은 고정 파일이라 빠르다
 * 사용자가 연 문서는 여기에 저장하지 않는다(문서는 서버를 거치지 않으므로 이 워커를 지나가지도 않는다). */
const VERSION = 'viewer-v1';
const SHELL = ['./', 'index.html', 'viewer.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/app.js', 'js/util.js', 'js/format.js', 'js/text-decode.js', 'js/paged.js', 'js/flow.js', 'js/find.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k.startsWith('viewer-')).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 다른 곳(CDN 등)은 건드리지 않는다
  const isLib = /\/tools\/viewer\/lib\//.test(url.pathname) || /\/tools\/common\/pdfjs\//.test(url.pathname);
  const isApp = /\/tools\/(viewer\/|common\/theme\.js)/.test(url.pathname) && !/\/_samples\//.test(url.pathname);
  if (!isLib && !isApp) return;
  if (isLib) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
