/* 상장 만들기 (웹판)
 *
 * 설치판(C:\vibe\award\app.py, tkinter + Pillow)의 그리는 규칙을 캔버스로 옮겼다.
 *   · 상 이름 → 이름 → 학년·반 → 수여 문구 순으로 세로로 쌓는다
 *   · 글자 크기·위치는 모두 배경 이미지 높이에 대한 비율 (어떤 크기의 배경이든 같은 모양)
 *   · 명단의 칸 이름은 별칭으로 찾는다 (성명·학급·수상명 …), 못 찾으면 앞 네 칸을 차례로
 *   · 파일 이름은 01_3학년2반_이도현_최우수상.png
 * 글꼴은 설치판처럼 맑은 고딕을 쓴다. 맑은 고딕이 없는 컴퓨터(맥·폰)에서만 Noto Sans KR 로 그린다.
 * 명단·이미지는 이 브라우저 밖으로 나가지 않는다.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'award.settings';
  var INK = 'rgb(26,47,92)';                       // 기본 배경의 제목과 같은 남색
  var DEFAULT_BODY = '위 학생은 2026학년도 교내 정보 경진대회에서 우수한 성적을 거두었기에 이 상장을 수여함';
  var PLACEHOLDERS = ['{이름}', '{학년}', '{반}', '{상}'];
  var COLUMNS = ['이름', '학년', '반', '상 이름'];
  var ALIASES = {
    '이름': ['이름', '성명', '학생명', '학생 이름', 'name'],
    '학년': ['학년', 'grade'],
    '반': ['반', '학급', 'class'],
    '상 이름': ['상 이름', '상이름', '상명', '상', '수상명', '상 종류', 'award'],
  };
  var DEFAULTS = { body: DEFAULT_BODY, showAward: true, showClass: true, nameY: 0.37, bodyY: 0.50, scale: 1.0 };

  var state = {
    settings: load(),
    students: [],          // [이름, 학년, 반, 상 이름]
    picked: {},            // 줄 번호 → true
    current: 0,
    bg: null,              // ImageBitmap
    bgName: '',
    family: '"Malgun Gothic", "맑은 고딕"',
    busy: false,
  };

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
    return Object.assign({}, DEFAULTS, s);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state.settings)); } catch (_) {} }

  /* ── 글꼴: 맑은 고딕이 있으면 그것, 없으면 Noto Sans KR ───────────── */

  function hasFont(name) {
    var c = document.createElement('canvas').getContext('2d');
    var probe = '가나다라마바사 상장 ABC 123';
    c.font = '40px monospace';
    var mono = c.measureText(probe).width;
    c.font = '40px "' + name + '", monospace';
    return c.measureText(probe).width !== mono;
  }

  function pickFont() {
    if (hasFont('Malgun Gothic') || hasFont('맑은 고딕')) {
      state.family = '"Malgun Gothic", "맑은 고딕"';
      $('fontNote').textContent = '글꼴: 맑은 고딕 (설치판과 같습니다)';
      return Promise.resolve();
    }
    state.family = '"Noto Sans KR"';
    $('fontNote').textContent = '이 컴퓨터에는 맑은 고딕이 없어 Noto Sans KR 로 그립니다. 윈도우에서 만들면 설치판과 똑같이 나옵니다.';
    return Promise.all([
      document.fonts.load('700 40px "Noto Sans KR"', '상장가'),
      document.fonts.load('400 40px "Noto Sans KR"', '상장가'),
    ]).catch(function () {});
  }

  function font(weight, px) { return weight + ' ' + Math.max(8, Math.round(px)) + 'px ' + state.family + ', sans-serif'; }

  /* ── 그리기 (app.py make_certificate 와 같은 규칙) ───────────────── */

  function wrap(ctx, text, maxWidth) {
    var lines = [];
    var cur = '';
    text.split(/\s+/).filter(Boolean).forEach(function (w) {
      var cand = (cur + ' ' + w).trim();
      if (cur && ctx.measureText(cand).width > maxWidth) { lines.push(cur); cur = w; }
      else cur = cand;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function fill(text, st) {
    var out = text;
    PLACEHOLDERS.forEach(function (t, i) { out = out.split(t).join(st[i] || ''); });
    return out;
  }

  function draw(cv, st) {
    var s = state.settings;
    var W = state.bg.width;
    var H = state.bg.height;
    cv.width = W;
    cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.drawImage(state.bg, 0, 0);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var scale = Number(s.scale);
    var nameY = Number(s.nameY) * H;
    var bodyY = Number(s.bodyY) * H;
    var name = st[0];
    var grade = st[1];
    var room = st[2];
    var award = st[3];

    if (s.showAward && award) {
      ctx.font = font(700, H * 0.032 * scale);
      ctx.fillText(award, W / 2, nameY - H * 0.085);
    }
    ctx.font = font(700, H * 0.055 * scale);
    ctx.fillText(name, W / 2, nameY);

    if (s.showClass && (grade || room)) {
      ctx.font = font(400, H * 0.022 * scale);
      var label = [grade ? grade + '학년' : '', room ? room + '반' : ''].filter(Boolean).join(' ');
      ctx.fillText(label, W / 2, nameY + H * 0.045);
    }

    var size = Math.max(8, Math.round(H * 0.026 * scale));
    ctx.font = font(400, size);
    var lh = Math.floor(size * 1.7);
    wrap(ctx, fill(s.body || DEFAULT_BODY, st), W * 0.64).forEach(function (line, i) {
      ctx.fillText(line, W / 2, bodyY + i * lh);
    });
  }

  var SAMPLE = ['홍길동', '1', '3', '우수상'];

  function preview() {
    if (!state.bg) return;
    var st = state.students[state.current] || SAMPLE;
    draw($('preview'), st);
    $('pvName').textContent = state.students.length ? '— ' + st[0] : '— 예시';
  }

  /* ── 명단 읽기 (app.py find_header · read_students 와 같다) ───────── */

  function norm(v) { return v == null ? '' : String(v).replace(/ /g, '').trim().toLowerCase(); }

  function findHeader(rows) {
    for (var i = 0; i < Math.min(rows.length, 20); i++) {
      var normalized = {};
      rows[i].forEach(function (c, pos) { if (c != null && c !== '' && !(norm(c) in normalized)) normalized[norm(c)] = pos; });
      var mapping = {};
      COLUMNS.forEach(function (col) {
        var hit = ALIASES[col].find(function (a) { return norm(a) in normalized; });
        if (hit) mapping[col] = normalized[norm(hit)];
      });
      if ('이름' in mapping && Object.keys(mapping).length >= 2) return { index: i, mapping: mapping };
    }
    return null;
  }

  function studentsFrom(rows) {
    if (!rows.length) return [];
    var found = findHeader(rows);
    var start = 0;
    var mapping = {};
    if (found) { start = found.index + 1; mapping = found.mapping; }
    else COLUMNS.forEach(function (c, i) { mapping[c] = i; });
    var out = [];
    rows.slice(start).forEach(function (row) {
      var v = COLUMNS.map(function (c) {
        var pos = mapping[c];
        var cell = pos != null && pos < row.length ? row[pos] : null;
        return cell == null ? '' : String(cell).trim();
      });
      if (v.some(Boolean)) out.push(v);
    });
    return out;
  }

  function readFile(file) {
    return file.arrayBuffer().then(function (buf) {
      var L = window.NodeLibs;
      var key = L.vfs.put('명단/' + file.name, new Uint8Array(buf));
      try { return L.sheets.read(key).rows; } finally { L.vfs.drop(key); }
    });
  }

  function setStudents(list, source) {
    state.students = list;
    state.picked = {};
    list.forEach(function (_, i) { state.picked[i] = true; });
    state.current = 0;
    $('excelInfo').textContent = list.length ? source + ' — ' + list.length + '명' : source + ' — 학생을 찾지 못했습니다';
    renderTable();
    preview();
  }

  /* ── 표 ──────────────────────────────────────────────────────────── */

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function picked() { return state.students.map(function (s, i) { return i; }).filter(function (i) { return state.picked[i]; }); }

  function renderTable() {
    var tb = $('rows');
    if (!state.students.length) {
      tb.innerHTML = '<tr><td colspan="5" class="empty">명단을 넣으면 여기에 나옵니다.</td></tr>';
    } else {
      tb.innerHTML = state.students.map(function (s, i) {
        return '<tr data-i="' + i + '" class="' + (i === state.current ? 'on' : '') + '"><td><input type="checkbox" data-ck="' + i + '"'
          + (state.picked[i] ? ' checked' : '') + '></td><td>' + esc(s[0]) + '</td><td>' + esc(s[1]) + '</td><td>'
          + esc(s[2]) + '</td><td>' + esc(s[3]) + '</td></tr>';
      }).join('');
    }
    var n = picked().length;
    $('count').textContent = state.students.length ? n + ' / ' + state.students.length + '명 고름' : '';
    $('ckAll').checked = state.students.length > 0 && n === state.students.length;
    $('btnPng').disabled = !n || state.busy;
    $('btnPdf').disabled = !n || state.busy;
  }

  $('rows').addEventListener('click', function (e) {
    var ck = e.target.closest('input[data-ck]');
    if (ck) {
      var i = Number(ck.dataset.ck);
      if (ck.checked) state.picked[i] = true; else delete state.picked[i];
      renderTable();
      return;
    }
    var tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    state.current = Number(tr.dataset.i);
    renderTable();
    preview();
  });
  $('ckAll').addEventListener('change', function () {
    var on = this.checked;
    state.picked = {};
    if (on) state.students.forEach(function (_, i) { state.picked[i] = true; });
    renderTable();
  });

  /* ── 손잡이 ──────────────────────────────────────────────────────── */

  function paintSettings() {
    var s = state.settings;
    $('body').value = s.body;
    $('showAward').checked = !!s.showAward;
    $('showClass').checked = !!s.showClass;
    $('nameY').value = s.nameY;
    $('bodyY').value = s.bodyY;
    $('scale').value = s.scale;
    $('nameYv').textContent = Number(s.nameY).toFixed(2);
    $('bodyYv').textContent = Number(s.bodyY).toFixed(2);
    $('scalev').textContent = Number(s.scale).toFixed(2);
  }

  function setting(patch) {
    Object.assign(state.settings, patch);
    save();
    paintSettings();
    preview();
  }

  $('body').addEventListener('input', function () { setting({ body: this.value }); });
  $('showAward').addEventListener('change', function () { setting({ showAward: this.checked }); });
  $('showClass').addEventListener('change', function () { setting({ showClass: this.checked }); });
  ['nameY', 'bodyY', 'scale'].forEach(function (id) {
    $(id).addEventListener('input', function () { var p = {}; p[id] = Number(this.value); setting(p); });
  });

  $('btnExcel').addEventListener('click', function () { $('pickExcel').click(); });
  $('pickExcel').addEventListener('change', function () {
    var f = this.files[0];
    this.value = '';
    if (!f) return;
    readFile(f).then(function (rows) { setStudents(studentsFrom(rows), f.name); })
      .catch(function (e) { $('excelInfo').textContent = f.name + ' — 읽지 못했습니다: ' + ((e && e.message) || e); });
  });
  $('btnSample').addEventListener('click', function () {
    setStudents([
      ['이도현', '3', '2', '최우수상'], ['한서윤', '1', '4', '장려상'], ['박채원', '2', '1', '우수상'],
      ['정우진', '3', '5', '노력상'], ['김하은', '1', '2', '우수상'],
    ], '예시 명단');
  });
  $('btnPaste').addEventListener('click', function () {
    var rows = $('taPaste').value.split(/\r?\n/).map(function (l) { return l.split(/\t|,/); });
    setStudents(studentsFrom(rows), '붙여 넣은 명단');
  });

  function useBg(blob, name) {
    return createImageBitmap(blob).then(function (bmp) {
      state.bg = bmp;
      state.bgName = name;
      $('bgInfo').textContent = '배경: ' + name + ' (' + bmp.width + ' × ' + bmp.height + ')';
      preview();
    });
  }
  function defaultBg() {
    return fetch('template.png').then(function (r) { return r.blob(); }).then(function (b) { return useBg(b, '기본 배경 (A4 세로)'); });
  }
  $('btnBg').addEventListener('click', function () { $('pickBg').click(); });
  $('pickBg').addEventListener('change', function () {
    var f = this.files[0];
    this.value = '';
    if (f) useBg(f, f.name).catch(function () { $('bgInfo').textContent = f.name + ' — 이미지를 열지 못했습니다'; });
  });
  $('btnBgReset').addEventListener('click', defaultBg);

  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault();
    var f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    if (/^image\//.test(f.type)) useBg(f, f.name);
    else readFile(f).then(function (rows) { setStudents(studentsFrom(rows), f.name); });
  });

  /* ── 내보내기 ────────────────────────────────────────────────────── */

  function safe(t) { return String(t).replace(/[\\/:*?"<>|]/g, '_').trim() || '무명'; }

  /** app.py certificate_path 와 같다 — 01_3학년2반_이도현_최우수상 */
  function fileBase(index, st) {
    var parts = [String(index).padStart(2, '0')];
    if (st[1] || st[2]) parts.push(st[1] + '학년' + st[2] + '반');
    parts.push(st[0]);
    if (st[3]) parts.push(st[3]);
    return safe(parts.join('_'));
  }

  function toBlob(cv, type, q) {
    return new Promise(function (res, rej) { cv.toBlob(function (b) { if (b) res(b); else rej(new Error('그림을 굽지 못했습니다')); }, type, q); });
  }

  function progress(done, total, text) {
    $('progWrap').hidden = false;
    $('progFill').style.width = Math.round(done / Math.max(1, total) * 100) + '%';
    $('progText').textContent = text;
  }

  function lock(on) {
    state.busy = on;
    renderTable();
    if (!on) $('progWrap').hidden = true;
  }

  function each(fn) {
    var list = picked();
    var cv = $('work');
    return list.reduce(function (chain, idx, n) {
      return chain.then(function () {
        progress(n, list.length, (n + 1) + ' / ' + list.length + ' — ' + state.students[idx][0]);
        draw(cv, state.students[idx]);
        return fn(cv, state.students[idx], n + 1);
      });
    }, Promise.resolve()).then(function () { return list.length; });
  }

  $('btnPng').addEventListener('click', function () {
    if (state.busy) return;
    lock(true);
    var z = Zip();
    each(function (cv, st, no) {
      return toBlob(cv, 'image/png').then(function (b) { return z.add('상장/' + fileBase(no, st) + '.png', b); });
    }).then(function (n) {
      Zip.download(z.finish(), '상장_' + n + '명.zip');
    }).catch(function (e) { alert('만들지 못했습니다: ' + e.message); }).then(function () { lock(false); });
  });

  /* 인쇄용 PDF — 한 장에 한 명, 쪽 크기는 배경 그림 크기를 150dpi 로 본 크기 (설치판과 같다) */
  $('btnPdf').addEventListener('click', function () {
    if (state.busy) return;
    lock(true);
    var docP = PDFLib.PDFDocument.create();
    each(function (cv) {
      return Promise.all([docP, toBlob(cv, 'image/jpeg', 0.95).then(function (b) { return b.arrayBuffer(); })]).then(function (r) {
        var doc = r[0];
        return doc.embedJpg(r[1]).then(function (img) {
          var w = cv.width * 72 / 150;
          var h = cv.height * 72 / 150;
          doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
        });
      });
    }).then(function (n) {
      return docP.then(function (doc) {
        doc.setTitle('상장');
        doc.setProducer('교실 도구함 — 상장 만들기');
        return doc.save();
      }).then(function (bytes) {
        Zip.download(new Blob([bytes], { type: 'application/pdf' }), '상장_' + n + '명.pdf');
      });
    }).catch(function (e) { alert('만들지 못했습니다: ' + e.message); }).then(function () { lock(false); });
  });

  /* ── 켜기 ────────────────────────────────────────────────────────── */

  paintSettings();
  pickFont().then(defaultBg).then(preview);

  window.__award = { state: state, studentsFrom: studentsFrom, fileBase: fileBase };
}());
