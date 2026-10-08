/* 화면 녹화 (웹판) — 설치판의 로컬 서버(server.js) 자리를 브라우저 안에서 대신한다.
 *
 * 설치판 화면(app.js · capture.js)은 fetch('/api/…') 와 EventSource('/api/events') 로 서버와 이야기한다.
 * 여기서 그 둘을 가로채 같은 대답을 돌려준다. 그래서 화면 잡기·영역 자르기·소리 섞기·녹화는
 * 설치판 코드가 그대로 돈다.
 *
 * 영상은 어디에 쌓이나
 *   · 저장 폴더를 고른 경우(크롬·엣지) — 그 폴더의 파일에 1~2초마다 바로 이어 쓴다. 긴 녹화에 안전하다.
 *   · 고르지 않은 경우 — 브라우저 메모리에 모았다가 끝나면 내려받기로 넘긴다.
 * 설치판만 되는 것(빨간 테두리·조작 막대·전역 단축키·창 내리기)은 "도우미 없음" 으로 알린다.
 * 창 안에서 누르는 F9 / F10 은 그대로 된다.
 */
(function (root) {
  'use strict';

  var S = root.Shared;
  var KEY = 'recorder.settings';
  var realFetch = root.fetch.bind(root);

  var DEFAULTS = {
    prefix: '화면녹화', quality: 'high', fps: 60, scale: 'origin', format: 'auto', saveMode: 'stream',
    systemAudio: true, micOn: false, micDeviceId: '', sysGain: 1, micGain: 1,
    aspect: 'free', lastRegion: null, countdown: 3, maxMinutes: 0, openFolderWhenDone: false,
    showBorder: false, showBar: false, hotkeys: false, minimizeWhileRecording: false,
  };

  var state = {
    settings: load(),
    dir: null,           // FileSystemDirectoryHandle (고른 저장 폴더)
    rec: null,           // 지금 받아 적는 녹화
    recent: [],          // 이번에 녹화한 것 {name, bytes, at, file, url, blob}
    listeners: [],
  };

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
    var out = Object.assign({}, DEFAULTS, s);
    out.theme = theme();
    return out;
  }
  function save() {
    var s = Object.assign({}, state.settings);
    delete s.theme;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
  }
  function theme() { return root.ToolsTheme ? root.ToolsTheme.current() : 'dark'; }

  function outDirText() {
    return state.dir ? state.dir.name + ' (고른 폴더에 바로 저장)' : '내려받기 폴더 (끝나면 내려받습니다)';
  }

  /* ── 서버가 보내던 소식 ──────────────────────────────────────────── */

  function emit(msg) {
    var data = JSON.stringify(msg);
    state.listeners.forEach(function (es) {
      if (typeof es.onmessage === 'function') {
        try { es.onmessage({ data: data }); } catch (_) {}
      }
    });
  }
  function note(level, text) { emit({ type: 'log', line: { level: level, text: text, at: Date.now() } }); }

  function FakeEventSource() {
    var es = this;
    es.onmessage = null;
    es.onerror = null;
    es.readyState = 1;
    es.close = function () { state.listeners = state.listeners.filter(function (x) { return x !== es; }); };
    state.listeners.push(es);
    setTimeout(function () {
      if (typeof es.onmessage === 'function') {
        es.onmessage({ data: JSON.stringify({
          type: 'hello', settings: state.settings, outDir: outDirText(), native: NATIVE, recent: recentItems(),
        }) });
      }
    }, 0);
  }

  var NATIVE = { available: false, hotkeys: [], monitors: [], lastError: '웹판에는 곁다리 도우미가 없습니다' };

  /* 메뉴에서 밝기를 바꾸면 설정에도 비춰 준다 */
  root.addEventListener('storage', function (e) {
    if (e.key !== 'tools.theme') return;
    state.settings.theme = theme();
    emit({ type: 'settings', settings: state.settings, outDir: outDirText() });
  });

  /* ── 녹화 받아 적기 ──────────────────────────────────────────────── */

  function stampName(ext) { return S.stampName(state.settings.prefix, new Date(), ext); }

  function begin(body) {
    var ext = String(body.ext || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'mp4';
    var name = stampName(ext);
    var rec = { id: 'r' + Date.now(), name: name, ext: ext, bytes: 0, parts: [], writable: null, chain: Promise.resolve(), error: null };
    var opened = Promise.resolve();
    if (state.dir) {
      opened = ensure(state.dir).then(function (ok) {
        if (!ok) throw new Error('저장 폴더에 쓸 권한을 받지 못했습니다. 폴더를 다시 골라 주세요.');
        return state.dir.getFileHandle(name, { create: true });
      }).then(function (fh) { rec.handle = fh; return fh.createWritable(); })
        .then(function (w) { rec.writable = w; });
    }
    return opened.then(function () {
      state.rec = rec;
      note('info', '녹화를 시작합니다 → ' + name);
      return { ok: true, id: rec.id, name: name, file: rec.id, dir: state.dir ? state.dir.name : '' };
    }, function (e) {
      return { ok: false, message: (e && e.message) || '저장할 파일을 열지 못했습니다' };
    });
  }

  function chunk(id, blob) {
    var rec = state.rec;
    if (!rec || rec.id !== id) return Promise.resolve({ ok: false, message: '받아 적는 녹화가 없습니다' });
    rec.chain = rec.chain.then(function () {
      if (rec.writable) return rec.writable.write(blob);
      rec.parts.push(blob);
      return null;
    }).then(function () { rec.bytes += blob.size; }, function (e) { rec.error = e; throw e; });
    return rec.chain.then(function () { return { ok: true, bytes: rec.bytes }; },
      function (e) { return { ok: false, message: (e && e.message) || '쓰지 못했습니다' }; });
  }

  function finish(body) {
    var rec = state.rec;
    if (!rec) return Promise.resolve({ ok: false, message: '끝낼 녹화가 없습니다' });
    state.rec = null;
    return rec.chain.catch(function () {}).then(function () {
      if (rec.writable) return rec.writable.close().then(function () { return rec.handle.getFile(); });
      return new Blob(rec.parts, { type: rec.ext === 'webm' ? 'video/webm' : 'video/mp4' });
    }).then(function (blob) {
      if (!blob.size) {
        if (state.dir && rec.handle) state.dir.removeEntry(rec.name).catch(function () {});
        note('warn', '영상이 한 조각도 들어오지 않았습니다.');
        return { ok: false, message: '녹화된 내용이 없습니다. (화면 잡기가 도중에 끊겼을 수 있습니다)' };
      }
      var item = {
        file: rec.id, name: rec.name, bytes: blob.size, at: Date.now(), blob: blob,
        url: URL.createObjectURL(blob), saved: !!rec.writable,
      };
      state.recent.unshift(item);
      if (state.recent.length > 12) {
        var old = state.recent.pop();
        URL.revokeObjectURL(old.url);
      }
      /* 폴더를 안 골랐으면 여기서 내려받기로 넘긴다 — 메모리에만 두면 창을 닫을 때 사라진다 */
      if (!item.saved) download(item);
      var ms = Number(body.ms) || 0;
      var result = {
        file: item.file, name: item.name, dir: item.saved ? state.dir.name : '내려받기',
        bytes: item.bytes, sizeText: S.fmtBytes(item.bytes), ms: ms, durationText: S.fmtDuration(ms),
        meta: body.meta || null, at: item.at,
      };
      note('ok', '저장했습니다 — ' + result.name + ' (' + result.sizeText + ', ' + result.durationText + ')');
      emit({ type: 'recent', items: recentItems() });
      return { ok: true, result: result };
    });
  }

  function drop() {
    var rec = state.rec;
    state.rec = null;
    if (rec && rec.writable) {
      rec.writable.abort().catch(function () {}).then(function () {
        if (state.dir) state.dir.removeEntry(rec.name).catch(function () {});
      });
    }
    return { ok: true };
  }

  function download(item) {
    var a = document.createElement('a');
    a.href = item.url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function recentItems() {
    return state.recent.map(function (r) { return { name: r.name, bytes: r.bytes, at: r.at, file: r.file }; });
  }

  function find(file) { return state.recent.find(function (r) { return r.file === file; }); }

  /* ── 저장 폴더 ───────────────────────────────────────────────────── */

  function ensure(h) {
    if (!h.queryPermission) return Promise.resolve(true);
    return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
      if (p === 'granted') return true;
      return h.requestPermission({ mode: 'readwrite' }).then(function (q) { return q === 'granted'; });
    });
  }

  function pickFolder() {
    if (typeof root.showDirectoryPicker !== 'function') {
      return Promise.resolve({ ok: false, message: '이 브라우저는 폴더에 바로 저장을 지원하지 않습니다. 끝나면 내려받기로 저장됩니다(크롬·엣지는 폴더 저장 가능).' });
    }
    return root.showDirectoryPicker({ id: 'recorder', mode: 'readwrite' }).then(function (h) {
      state.dir = h;
      emit({ type: 'settings', settings: state.settings, outDir: outDirText() });
      return { ok: true, outDir: outDirText() };
    }, function (e) {
      if (e && e.name === 'AbortError') return { cancelled: true };
      return { ok: false, message: '폴더를 열지 못했습니다: ' + ((e && e.message) || e) };
    });
  }

  /* ── 길목 ────────────────────────────────────────────────────────── */

  function routes(method, path, url, body, raw) {
    var key = method + ' ' + path;
    switch (key) {
      case 'GET /api/state':
        return { settings: state.settings, outDir: outDirText(), native: NATIVE };
      case 'GET /api/recent':
        return { ok: true, items: recentItems(), dir: outDirText() };
      case 'POST /api/log':
        note(body.level || 'info', String(body.text || ''));
        return { ok: true };
      case 'POST /api/settings': {
        var patch = Object.assign({}, body.patch || {});
        if (patch.theme && patch.theme !== theme() && root.ToolsTheme) root.ToolsTheme.toggle();
        delete patch.theme;
        Object.assign(state.settings, patch);
        state.settings.theme = theme();
        save();
        return { ok: true, settings: state.settings, outDir: outDirText() };
      }
      case 'POST /api/helper/ensure':
      case 'POST /api/helper/hotkeys':
      case 'POST /api/helper/overlay':
      case 'POST /api/helper/window':
        return { ok: false, native: NATIVE };
      case 'POST /api/rec/begin': return begin(body);
      case 'POST /api/rec/chunk': return chunk(url.searchParams.get('id'), raw);
      case 'POST /api/rec/finish': return finish(body);
      case 'POST /api/rec/drop': return drop();
      case 'POST /api/pick-folder': return pickFolder();
      case 'POST /api/set-folder': return { ok: false, message: '웹판에서는 [폴더 바꾸기] 로 골라 주세요.' };
      case 'POST /api/open-file':
      case 'POST /api/reveal': {
        var it = find(body.file);
        if (it) download(it);
        return { ok: !!it };
      }
      case 'POST /api/open-folder':
        note('info', state.dir
          ? '저장 폴더: ' + state.dir.name + ' — 탐색기에서 직접 열어 주세요(브라우저는 폴더를 열어 줄 수 없습니다).'
          : '폴더를 고르지 않아 브라우저의 내려받기 폴더로 저장됩니다.');
        return { ok: true };
      case 'POST /api/quit':
        return { ok: true };
      default:
        return { ok: false, message: '웹판에는 없는 기능입니다: ' + path };
    }
  }

  root.fetch = function (input, init) {
    var href = typeof input === 'string' ? input : (input && input.url) || '';
    var url = new URL(href, location.href);
    if (url.origin !== location.origin || url.pathname.indexOf('/api/') !== 0) return realFetch(input, init);
    var method = ((init && init.method) || 'GET').toUpperCase();
    var raw = init && init.body;
    var body = {};
    if (typeof raw === 'string') { try { body = JSON.parse(raw); } catch (_) {} }
    return Promise.resolve(routes(method, url.pathname, url, body, raw)).then(function (obj) {
      return new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json' } });
    });
  };

  var RealES = root.EventSource;
  root.EventSource = function (u) {
    var url = new URL(u, location.href);
    if (url.pathname === '/api/events') return new FakeEventSource();
    return new RealES(u);
  };

  /** 결과 재생기에 줄 주소 (설치판은 /api/file?p=… 였다) */
  root.LocalServer = { urlFor: function (file) { var it = find(file); return it ? it.url : ''; } };
}(window));
