/* 개인정보 지우개 (웹판) — 설치판의 로컬 서버(server.js) 자리를 브라우저 안에서 대신한다.
 *
 * 화면(app.js)은 설치판과 똑같이 api('/api/…') 를 부르고, 여기서 같은 모양의 snapshot 을 돌려준다.
 * 찾기·검산·가리기·다시 열어 확인은 설치판 lib(detect · peek · zipedit · scrub) 를 그대로 묶은
 * nodelibs.js 가 한다.
 *
 * 설치판과 다른 점 — 웹판은 **원본을 고치지 않는다.**
 *   설치판: 원본을 백업하고 그 자리에서 고친다 → 되돌리기·격리가 필요하다
 *   웹판  : 가린 **사본**을 ZIP 으로 내려받는다 → 원본은 그대로이니 되돌릴 일이 없다
 * 화면에는 설치판과 같이 가린 글과 앞뒤 글만 간다. 고른 파일은 이 탭의 메모리에만 있다.
 */
(function (root) {
  'use strict';

  var L = root.NodeLibs;
  var scrub = L.scrub;
  var detect = L.detect;
  var KEY = 'privacy.settings';
  var VIEW_LIMIT = 400;

  var state = {
    settings: load(),
    label: '',
    files: [],        // 고른 파일 {path(=가짜 fs 이름), name, ext, kind, size, dir, rel}
    results: [],
    scanInfo: null,
    busy: false,
    listeners: [],
  };

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
    var out = Object.assign({}, scrub.DEFAULT_SETTINGS, s);
    var known = detect.ruleList().map(function (r) { return r.id; });
    out.rules = (Array.isArray(out.rules) ? out.rules : []).filter(function (id) { return known.indexOf(id) >= 0; });
    if (!out.rules.length) out.rules = detect.defaultOn();
    out.skipBig = Math.max(1, Math.min(500, Number(out.skipBig) || 40));
    out.recursive = !!out.recursive;
    out.showMaybe = out.showMaybe !== false;
    return out;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        rules: state.settings.rules, recursive: state.settings.recursive,
        skipBig: state.settings.skipBig, showMaybe: state.settings.showMaybe,
      }));
    } catch (_) {}
  }

  /* ── 진행 알림 (설치판의 SSE 자리) ───────────────────────────────── */

  function emit(type, data) {
    var msg = { data: JSON.stringify(Object.assign({ type: type }, data || {})) };
    state.listeners.forEach(function (es) { if (es.onmessage) { try { es.onmessage(msg); } catch (_) {} } });
  }
  var RealES = root.EventSource;
  root.EventSource = function (u) {
    if (String(u).indexOf('/api/events') < 0) return new RealES(u);
    var es = { onmessage: null, onerror: null, close: function () {} };
    state.listeners.push(es);
    return es;
  };

  /* ── 화면에 보내는 모양 (설치판 server.js 와 같다) ────────────────── */

  function resultView(r) {
    return {
      path: r.path, name: r.name, dir: r.dir, rel: r.rel, ext: r.ext, kind: r.kind, size: r.size,
      chars: r.chars, sure: r.sure, maybe: r.maybe, canMask: r.canMask, why: r.why, error: r.error,
      truncated: !!r.truncated,
      hits: r.hits.map(function (h) {
        return { label: h.label, level: h.level, grade: h.grade, masked: h.masked, before: h.context.before, after: h.context.after };
      }),
    };
  }

  function visibleHits(r) {
    return state.settings.showMaybe ? r : Object.assign({}, r, {
      hits: r.hits.filter(function (h) { return h.grade === 'sure'; }), maybe: 0,
    });
  }

  function summary(list) {
    var withHits = list.filter(function (r) { return r.hits.length; });
    var byLabel = {};
    var sure = 0;
    var maybe = 0;
    list.forEach(function (r) {
      sure += r.sure;
      maybe += r.maybe;
      r.hits.forEach(function (h) {
        byLabel[h.label] = byLabel[h.label] || { sure: 0, maybe: 0 };
        byLabel[h.label][h.grade] += 1;
      });
    });
    return {
      files: list.length, dirty: withHits.length, clean: list.length - withHits.length, sure: sure, maybe: maybe,
      fixable: withHits.filter(function (r) { return r.canMask; }).length,
      unfixable: withHits.filter(function (r) { return !r.canMask; }).length,
      unreadable: list.filter(function (r) { return r.error; }).length,
      byLabel: byLabel,
    };
  }

  function snapshot() {
    var list = state.results.map(visibleHits);
    var dirty = list.filter(function (r) { return r.hits.length; });
    return {
      settings: state.settings,
      rules: detect.ruleList(),
      dir: state.label,
      scanInfo: state.scanInfo,
      summary: list.length ? summary(list) : null,
      results: dirty.slice(0, VIEW_LIMIT).map(resultView),
      shown: Math.min(dirty.length, VIEW_LIMIT),
      totalDirty: dirty.length,
      undo: [],
      busy: state.busy,
      maxFiles: scrub.MAX_FILES,
    };
  }

  /* ── 파일 받기 · 훑기 ───────────────────────────────────────────── */

  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

  /**
   * 고르거나 끌어다 놓은 파일들을 받아 둔다 (설치판의 폴더 훑기 자리).
   * list: [{file: File, rel: '폴더/하위/이름.hwpx'}]
   */
  function setFiles(list, label) {
    L.vfs.clear();
    var limit = state.settings.skipBig * 1024 * 1024;
    var files = [];
    var skipped = 0;
    var folders = {};
    var used = {};
    var jobs = list.map(function (it) {
      var name = it.file.name;
      var rel = it.rel || name;
      var depth = rel.split('/').length;
      if (!state.settings.recursive && depth > 2) { skipped += 1; return null; }
      if (/^[.~]/.test(name)) return null;
      var ext = scrub.extOf(name);
      if (!scrub.DOC_EXTS[ext] || !it.file.size || it.file.size > limit) { skipped += 1; return null; }
      if (files.length >= scrub.MAX_FILES) return null;
      var key = rel;
      for (var n = 2; used[key]; n++) key = rel + ' (' + n + ')';
      used[key] = 1;
      var dir = rel.indexOf('/') >= 0 ? rel.slice(0, rel.lastIndexOf('/')) : '';
      folders[dir] = 1;
      var f = { path: key, name: name, ext: ext, kind: scrub.DOC_EXTS[ext], size: it.file.size, dir: dir, rel: rel, file: it.file };
      files.push(f);
      return f;
    });
    state.label = label || '고른 파일';
    state.files = files;
    state.scanInfo = { files: files.length, skipped: skipped, folders: Object.keys(folders).length, capped: files.length >= scrub.MAX_FILES, at: Date.now() };
    return Promise.all(files.map(function (f) {
      return f.file.arrayBuffer().then(function (b) { L.vfs.put(f.path, new Uint8Array(b)); });
    })).then(function () { return jobs; });
  }

  function scanAll() {
    if (state.busy) return Promise.resolve({ ok: false, message: '이미 훑는 중입니다' });
    state.busy = true;
    emit('scan-start');
    var out = [];
    var hitCount = 0;
    var i = 0;
    function step() {
      if (i >= state.files.length) return Promise.resolve();
      var end = Math.min(state.files.length, i + 6);
      for (; i < end; i++) {
        var f = state.files[i];
        var r = scrub.inspect(f, state.settings.rules);
        delete r.file;
        hitCount += r.hits.length;
        if (hitCount > 20000) { r.hits = r.hits.slice(0, 20); r.truncated = true; }
        out.push(r);
      }
      emit('scan-progress', { done: i, total: state.files.length, name: state.files[i - 1].name });
      return tick().then(step);
    }
    return step().then(function () {
      state.results = out;
      state.busy = false;
      emit('scan-end', { ok: true });
      return Object.assign({ ok: true }, snapshot());
    }, function (e) {
      state.busy = false;
      emit('scan-end', { ok: false });
      return { ok: false, message: (e && e.message) || '훑지 못했습니다' };
    });
  }

  /* ── 가린 사본 만들기 ───────────────────────────────────────────── */

  function maskCopies(paths) {
    var want = {};
    (paths || []).forEach(function (p) { want[p] = 1; });
    var targets = state.results.filter(function (r) { return want[r.path] && r.canMask && r.hits.length; });
    if (!targets.length) return Promise.resolve({ ok: false, message: '고칠 수 있는 파일이 없습니다' });
    state.busy = true;
    emit('work-start', { total: targets.length });
    var rules = state.settings.rules;
    var z = root.Zip();
    var work = [];
    var done = 0;
    var i = 0;

    function one(t) {
      var made;
      try {
        made = scrub.PLAIN_EDIT.has(t.ext) ? scrub.maskPlain(t.path, rules) : scrub.maskZip(t.path, t.ext, rules);
      } catch (e) {
        return Promise.resolve({ path: t.path, ok: false, message: (e && e.message) || '고치지 못했습니다' });
      }
      if (made.error) return Promise.resolve({ path: t.path, ok: false, message: made.error });
      if (!made.changed || !made.buffer) {
        return Promise.resolve({
          path: t.path, ok: false, changed: 0,
          message: made.asciiOnly ? '가릴 것이 없습니다 (이 파일은 인코딩 때문에 한글이 든 규칙은 건너뜁니다)'
            : '가릴 것이 없습니다 (글자가 여러 조각으로 나뉘어 있을 수 있습니다)',
        });
      }
      /* 설치판과 같은 마지막 안전장치 — 고친 사본을 다시 열어 글자를 꺼내 본다 */
      var probe = '확인중/' + t.path;
      L.vfs.put(probe, made.buffer);
      var v = scrub.verify(probe, t.ext, t.chars, rules);
      L.vfs.drop(probe);
      if (!v.ok) return Promise.resolve({ path: t.path, ok: false, rolledBack: true, message: v.why + ' — 이 파일은 사본에 넣지 않았습니다' });
      return z.add(t.rel, new Blob([made.buffer])).then(function () {
        done += 1;
        return {
          path: t.path, ok: true, changed: made.changed, left: v.left,
          message: v.left ? v.left + '군데가 아직 남았습니다 (글자가 조각나 있을 수 있습니다) — 직접 확인해 주세요' : '',
        };
      });
    }

    function step() {
      if (i >= targets.length) return Promise.resolve();
      var t = targets[i++];
      return one(t).then(function (r) {
        work.push(r);
        emit('work-progress', { done: i, total: targets.length });
        return tick();
      }).then(step);
    }

    return step().then(function () {
      state.busy = false;
      emit('work-end', { ok: true });
      if (done) {
        var stamp = new Date();
        var p = function (n) { return String(n).padStart(2, '0'); };
        root.Zip.download(z.finish(), '개인정보가림_' + stamp.getFullYear() + p(stamp.getMonth() + 1) + p(stamp.getDate()) + '.zip');
      }
      return Object.assign({ ok: done > 0, done: done, work: work,
        message: done ? '' : '가린 사본을 하나도 만들지 못했습니다' }, snapshot());
    });
  }

  function exportCsv() {
    var dirty = state.results.filter(function (r) { return r.hits.length; });
    if (!state.results.length) return { ok: false, message: '먼저 파일을 넣어 주세요' };
    /* 설치판 toCsv 는 dir 을 폴더 기준 상대 경로로 바꾼다 — 웹판의 dir 은 이미 상대 경로다 */
    var csv = scrub.toCsv(dirty.map(function (r) { return Object.assign({}, r, { dir: r.dir || '.' }); }), '');
    var t = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    root.Zip.download(new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      '개인정보 점검 ' + t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()) + '.csv');
    return { ok: true, rows: dirty.reduce(function (n, r) { return n + r.hits.length; }, 0) };
  }

  /* ── 길목 ────────────────────────────────────────────────────────── */

  var routes = {
    'GET /api/env': function () { return snapshot(); },
    'POST /api/scan': function () { return scanAll(); },
    'POST /api/settings': function (b) {
      var patch = b.settings || {};
      Object.assign(state.settings, patch);
      save();
      /* 규칙이 바뀌면 다시 찾는다 (파일은 이미 메모리에 있다) */
      if (patch.rules && state.files.length) return scanAll();
      return snapshot();
    },
    'POST /api/mask': function (b) { return maskCopies(b.paths); },
    'POST /api/export': function () { return exportCsv(); },
  };

  function call(p, body) {
    var fn = routes[(body === undefined ? 'GET ' : 'POST ') + p];
    if (!fn) return Promise.reject(new Error('웹판에는 없는 기능입니다: ' + p));
    try { return Promise.resolve(fn(body || {})); } catch (e) { return Promise.reject(e); }
  }

  /** 파일을 받아 곧바로 훑는다 */
  function take(list, label) {
    return setFiles(list, label).then(scanAll);
  }

  root.LocalApi = { call: call, take: take };
}(window));
