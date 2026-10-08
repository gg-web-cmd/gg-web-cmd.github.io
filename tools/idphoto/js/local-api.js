/* 증명사진 만들기 (웹판) — 설치판의 로컬 서버(server.js) 자리를 브라우저 안에서 대신한다.
 *
 * 화면(app.js)은 설치판과 똑같이 api('/api/…') 를 부른다. 여기서 그 길목을 받아
 * 설치판 server.js 와 같은 모양의 snapshot 을 돌려준다. 규격·짝짓기·이름 짓기·명단 읽기는
 * 설치판 lib(photos.js · roster.js) 를 그대로 묶은 nodelibs.js 가 한다.
 *
 * 설치판과 다른 점
 *   · 폴더를 "훑는" 대신 사용자가 고르거나 끌어다 놓은 사진 파일을 받는다
 *   · 명단은 저장하지 않는다 — 학생 이름이 공용 컴퓨터 브라우저에 남지 않게 (설정만 남긴다)
 */
(function (root) {
  'use strict';

  var L = root.NodeLibs;
  var photos = L.photos;
  var rosterLib = L.roster;
  var KEY = 'idphoto.settings';

  var state = {
    settings: load(),
    roster: { students: [], classes: [], source: '' },
    label: '',
    files: [],          // {name, size, ext, maybe, url, file}
    scanInfo: null,
  };

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
    return photos.normalizeSettings(s);
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state.settings)); } catch (_) {}
  }

  function snapshot() {
    var pairs = photos.pair(state.files, state.roster.students, state.settings.pairBy);
    return {
      settings: state.settings,
      presets: photos.PRESETS,
      spec: photos.resolvePreset(state.settings),
      dir: state.label,
      scanInfo: state.scanInfo,
      roster: {
        count: state.roster.students.length,
        classes: state.roster.classes,
        source: state.roster.source || '',
        students: state.roster.students.map(function (s) { return { id: s.id, cls: s.cls, no: s.no, name: s.name, sid: s.sid }; }),
      },
      files: state.files.map(function (f, i) {
        var st = pairs[i] && pairs[i].student;
        return {
          name: f.name, size: f.size, ext: f.ext, maybe: f.maybe, url: f.url,
          student: st ? { id: st.id, name: st.name, cls: st.cls, no: st.no } : null,
          out: photos.outName(state.settings, st, f.name, i),
        };
      }),
      maxFiles: photos.MAX_FILES,
    };
  }

  /** 고르거나 끌어다 놓은 파일들로 목록을 새로 짠다 (설치판의 scan 자리) */
  function setFiles(list, label) {
    state.files.forEach(function (f) { URL.revokeObjectURL(f.url); });
    var files = [];
    var skipped = 0;
    list.forEach(function (file) {
      if (files.length >= photos.MAX_FILES) return;
      var ext = photos.extOf(file.name);
      var known = photos.IMAGE_EXTS.indexOf(ext) >= 0;
      var maybe = photos.MAYBE_EXTS.indexOf(ext) >= 0;
      if ((!known && !maybe) || !file.size || /^[.~]/.test(file.name)) { skipped += 1; return; }
      files.push({ name: file.name, size: file.size, ext: ext, maybe: maybe, file: file });
    });
    files.sort(function (a, b) { return photos.naturalCompare(a.name, b.name); });
    files.forEach(function (f) { f.url = URL.createObjectURL(f.file); });
    state.files = files;
    state.label = files.length ? (label || '고른 사진') : '';
    state.scanInfo = { files: files.length, skipped: skipped, capped: files.length >= photos.MAX_FILES, at: Date.now() };
    return snapshot();
  }

  function readRosterFile(file) {
    return file.arrayBuffer().then(function (buf) {
      var name = L.vfs.put('명단/' + file.name, new Uint8Array(buf));
      try { return rosterLib.readFile(name); } finally { L.vfs.drop(name); }
    });
  }

  function setRoster(parsed, source) {
    state.roster = { students: parsed.students, classes: parsed.classes, source: source };
    return Object.assign({ ok: true, count: parsed.students.length, skippedCount: parsed.skippedCount }, snapshot());
  }

  var routes = {
    'GET /api/env': function () { return snapshot(); },
    'POST /api/settings': function (b) {
      state.settings = photos.normalizeSettings(Object.assign({}, state.settings, b.settings || {}));
      save();
      return snapshot();
    },
    'POST /api/roster': function (b) {
      if (b.file) return readRosterFile(b.file).then(function (p) { return setRoster(p, b.file.name); });
      if (b.text == null) return { ok: false, message: '넣을 명단이 없습니다' };
      return setRoster(rosterLib.parseText(b.text), '붙여넣기');
    },
    'POST /api/roster-clear': function () {
      state.roster = { students: [], classes: [], source: '' };
      return snapshot();
    },
    /* 짝이 어긋났을 때 고치는 길 — 순서 짝짓기에서는 명단 자체의 순서를 바꾼다 (설치판과 같다) */
    'POST /api/repair': function (b) {
      var i = Number(b.index);
      if (!Number.isInteger(i) || i < 0 || i >= state.files.length) return { ok: false, message: '그 사진이 없습니다' };
      var list = state.roster.students;
      var to = list.findIndex(function (s) { return s.id === b.studentId; });
      if (to < 0) return { ok: false, message: '그 학생이 없습니다' };
      if (state.settings.pairBy === 'order') {
        var moved = list.splice(to, 1)[0];
        list.splice(Math.min(i, list.length), 0, moved);
      }
      return Object.assign({ ok: true }, snapshot());
    },
  };

  function call(p, body) {
    var key = (body === undefined ? 'GET ' : 'POST ') + p;
    var fn = routes[key];
    if (!fn) return Promise.reject(new Error('웹판에는 없는 기능입니다: ' + p));
    try { return Promise.resolve(fn(body || {})); } catch (e) { return Promise.reject(e); }
  }

  root.LocalApi = { call: call, setFiles: setFiles, safeName: rosterLib.safeName };
}(window));
