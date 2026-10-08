/* 명단 합치기 (웹판) — 설치판의 로컬 서버(server.js) 자리를 브라우저 안에서 대신한다.
 *
 * 화면(app.js)은 설치판과 똑같이 api('/api/…') 를 부르고, 여기서 같은 모양의 snapshot 을 돌려준다.
 * 명단 읽기·합치기·엑셀 만들기는 설치판 lib(roster · sheets · merge) 를 그대로 묶은
 * nodelibs.js 가 한다. 그래서 화면에 보이는 표와 내려받는 파일이 설치판과 똑같다.
 *
 * 명단(학생 이름)은 어디에도 저장하지 않는다 — 창을 닫으면 사라진다.
 */
(function (root) {
  'use strict';

  var L = root.NodeLibs;
  var merge = L.merge;
  var sheets = L.sheets;
  var VIEW_LIMIT = 600;

  var state = { lists: [], result: null, only: 'all-rows', nextId: 1 };

  function recompute() {
    if (state.lists.length < 1) { state.result = null; return; }
    state.result = merge.merge(state.lists[0], state.lists.slice(1));
  }

  function listView(l, i) {
    return {
      id: l.id, label: l.label, file: l.file, name: l.file,
      count: l.students.length, skipped: l.skipped, header: l.header,
      pick: Number.isInteger(l.pick) ? l.pick : -1,
      base: i === 0,
    };
  }

  function snapshot() {
    var r = state.result;
    return {
      lists: state.lists.map(listView),
      maxLists: merge.MAX_LISTS,
      only: state.only,
      header: r ? r.header : [],
      rows: r ? r.rows.slice(0, VIEW_LIMIT) : [],
      shown: r ? Math.min(r.rows.length, VIEW_LIMIT) : 0,
      total: r ? r.rows.length : 0,
      extras: r ? r.extras.slice(0, 200) : [],
      stats: r ? r.stats : null,
    };
  }

  /** 파일 이름에서 명단 이름표를 지어 준다 (급식지원자명단.xlsx → 급식지원자명단) */
  function labelFrom(name) {
    var base = String(name).replace(/\.[A-Za-z0-9]{1,12}$/, '');
    return base.replace(/[_\-]+/g, ' ').trim().slice(0, 20) || '명단';
  }

  function find(id) { return state.lists.find(function (x) { return x.id === id; }); }

  /** 브라우저의 File 하나를 읽어 명단으로 더한다 */
  function addFile(file) {
    if (state.lists.length >= merge.MAX_LISTS) {
      return Promise.resolve({ ok: false, message: '명단은 ' + merge.MAX_LISTS + '개까지 넣을 수 있습니다' });
    }
    return file.arrayBuffer().then(function (buf) {
      /* 설치판 lib 는 디스크 경로를 받는다 — 가짜 fs 에 이름을 붙여 넣어 두고 그 이름을 준다 */
      var key = 'l' + state.nextId + '/' + file.name;
      L.vfs.put(key, new Uint8Array(buf));
      var r;
      try { r = merge.readList(key); } finally { L.vfs.drop(key); }
      var l = {
        id: 'l' + state.nextId++, file: file.name, label: labelFrom(file.name),
        header: r.header, students: r.students, skipped: r.skipped, pick: -1,
      };
      state.lists.push(l);
      recompute();
      return Object.assign({ ok: true, added: l.label, count: l.students.length, skipped: l.skipped }, snapshot());
    }).catch(function (e) {
      return { ok: false, message: (e && e.message) || '읽지 못했습니다' };
    });
  }

  function exportBlob(format) {
    if (!state.result) return { ok: false, message: '먼저 명단을 넣어 주세요' };
    var asCsv = format === 'csv';
    var rows = merge.toRows(state.result, { only: state.only === 'all-rows' ? '' : state.only, withExtras: true });
    var t = new Date();      // 한국 시간 그대로 (toISOString 은 UTC 라 새벽에 하루 전 날짜가 된다)
    var stamp = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    var blob = asCsv
      ? new Blob([sheets.writeCsv(rows)], { type: 'text/csv;charset=utf-8' })
      : new Blob([sheets.writeXlsx(rows, '명단 대조')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return { ok: true, blob: blob, file: '명단 대조 ' + stamp + (asCsv ? '.csv' : '.xlsx'), rows: rows.length };
  }

  var routes = {
    'GET /api/env': function () { return snapshot(); },
    'POST /api/remove': function (b) {
      state.lists = state.lists.filter(function (l) { return l.id !== b.id; });
      recompute();
      return snapshot();
    },
    'POST /api/label': function (b) {
      var l = find(b.id);
      if (l) l.label = String(b.label || l.label).slice(0, 20);
      recompute();
      return snapshot();
    },
    'POST /api/pick': function (b) {
      var l = find(b.id);
      if (l) l.pick = Number.isInteger(b.pick) ? b.pick : -1;
      recompute();
      return snapshot();
    },
    'POST /api/make-base': function (b) {
      var i = state.lists.findIndex(function (x) { return x.id === b.id; });
      if (i > 0) {
        state.lists.unshift(state.lists.splice(i, 1)[0]);
        recompute();
      }
      return snapshot();
    },
    'POST /api/only': function (b) {
      state.only = ['all-rows', 'all', 'some', 'none'].indexOf(b.only) >= 0 ? b.only : 'all-rows';
      return snapshot();
    },
    'POST /api/clear': function () {
      state.lists = [];
      state.result = null;
      return snapshot();
    },
    'POST /api/export': function (b) { return exportBlob(b.format); },
  };

  function call(p, body) {
    var fn = routes[(body === undefined ? 'GET ' : 'POST ') + p];
    if (!fn) return Promise.reject(new Error('웹판에는 없는 기능입니다: ' + p));
    try { return Promise.resolve(fn(body || {})); } catch (e) { return Promise.reject(e); }
  }

  root.LocalApi = { call: call, addFile: addFile };
}(window));
