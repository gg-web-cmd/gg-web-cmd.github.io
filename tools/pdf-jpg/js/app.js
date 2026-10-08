/* 화면 다루기 — 고르고, 미리 보여 주고, 순서대로 굽는다. (웹판)
 *
 * 실제로 쪽을 그리는 일은 js/convert.js(pdf.js) 가 한다.
 * 설치판은 로컬 서버가 파일을 썼지만, 웹판은 두 가지 길로 내준다.
 *   · ZIP 하나로 받기 — 어느 브라우저든 된다
 *   · 폴더에 바로 저장 — 크롬·엣지의 폴더 열기(File System Access) 로 직접 쓴다
 * 설정은 이 브라우저의 localStorage 에만 남는다.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var S = window.Shared;
  var KEY = 'pdf-to-jpg.settings';
  var CAN_FOLDER = typeof window.showDirectoryPicker === 'function';

  var DEFAULTS = {
    output: 'zip',              // zip · folder
    subFolder: 'name',          // '' 그대로 · 'name' PDF 이름으로 하위 폴더
    nameMode: 'pdf',
    customBase: '',
    sep: 'under',
    start: 1,
    digits: 'auto',
    omitWhenSingle: false,
    onDuplicate: 'rename',
    sizeMode: 'dpi',
    dpi: 200,
    longPx: 2000,
    quality: 'high',
    range: '',
  };

  /* ── 상태 ────────────────────────────────────────────────────────── */

  var state = {
    settings: loadSettings(),
    dirHandle: null,      // 폴더에 바로 저장할 때 고른 폴더
    files: [],
    seq: 0,
    running: false,
    stopping: false,
    lastZip: null,
    thumbUrls: [],
  };

  function loadSettings() {
    var s = Object.assign({}, DEFAULTS);
    try { Object.assign(s, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) {}
    if (!CAN_FOLDER) s.output = 'zip';
    return s;
  }

  function logLine(level, text) {
    var box = $('log');
    var div = document.createElement('div');
    var cls = { ok: 'l-ok', warn: 'l-warn', err: 'l-err' }[level] || '';
    if (cls) div.className = cls;
    var t = new Date();
    var hh = String(t.getHours()).padStart(2, '0');
    var mm = String(t.getMinutes()).padStart(2, '0');
    var ss = String(t.getSeconds()).padStart(2, '0');
    div.textContent = hh + ':' + mm + ':' + ss + '  ' + text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    while (box.childNodes.length > 300) box.removeChild(box.firstChild);
  }

  function saveSettings(patch) {
    Object.assign(state.settings, patch);
    try { localStorage.setItem(KEY, JSON.stringify(state.settings)); } catch (_) {}
    refreshPreview();
  }

  /* ── 설정 ↔ 화면 ─────────────────────────────────────────────────── */

  function seg(id, value, onPick) {
    var box = $(id);
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.dataset.v === value);
      if (!b.dataset.bound) {
        b.dataset.bound = '1';
        b.addEventListener('click', function () { if (!b.disabled) onPick(b.dataset.v); });
      }
    });
  }

  function applySettings() {
    var s = state.settings;
    seg('segName', s.nameMode, function (v) { saveSettings({ nameMode: v }); applySettings(); });
    $('rowCustom').hidden = s.nameMode !== 'custom';
    $('customBase').value = s.customBase;

    $('sep').value = s.sep;
    $('start').value = s.start;
    $('digits').value = String(s.digits);
    $('omitWhenSingle').checked = s.omitWhenSingle;

    seg('segWhere', s.output, function (v) { saveSettings({ output: v }); applySettings(); });
    var folderBtn = $('segWhere').querySelector('[data-v=folder]');
    if (!CAN_FOLDER) {
      folderBtn.disabled = true;
      folderBtn.title = '크롬·엣지에서만 됩니다';
    }
    $('rowOutDir').hidden = s.output !== 'folder';
    $('rowDup').hidden = s.output !== 'folder';
    $('subFolder').checked = s.subFolder === 'name';
    $('onDuplicate').value = s.onDuplicate;

    seg('segSize', s.sizeMode, function (v) { saveSettings({ sizeMode: v }); applySettings(); });
    $('rowDpi').hidden = s.sizeMode !== 'dpi';
    $('rowLong').hidden = s.sizeMode !== 'long';
    $('dpi').value = String(s.dpi);
    $('longPx').value = String(s.longPx);
    $('quality').value = s.quality;
    $('range').value = s.range;

    refreshWhere();
    refreshPreview();
  }

  function refreshWhere() {
    $('outDir').value = state.dirHandle ? state.dirHandle.name : '';
  }

  /* ── 이름 규칙 ───────────────────────────────────────────────────── */

  function baseNameFor(f) {
    var s = state.settings;
    if (s.nameMode === 'custom' && s.customBase.trim()) {
      /* 여러 개를 한꺼번에 바꿀 때, 내가 정한 이름 하나로는 서로 덮어쓰게 된다.
       * 그래서 두 개 이상이면 뒤에 PDF 이름을 붙여 구분한다. */
      var base = s.customBase.trim();
      if (state.files.length > 1) return base + ' ' + (f ? f.stem : '');
      return base;
    }
    return f ? f.stem : 'PDF';
  }

  function nameOpt(f, total) {
    var s = state.settings;
    return {
      base: baseNameFor(f),
      total: total,
      sep: s.sep,
      start: s.start,
      digits: s.digits,
      omitWhenSingle: s.omitWhenSingle,
      ext: 'jpg',
    };
  }

  function pagesOf(f) {
    if (!f.pages) return [];
    return S.parseRange(state.settings.range, f.pages);
  }

  /* ── 미리 보여 주기 ──────────────────────────────────────────────── */

  function refreshPreview() {
    var box = $('namePreview');
    var f = state.files.find(function (x) { return x.pages > 0; });
    if (!f) {
      box.textContent = 'PDF 를 고르면 여기에 보여 드립니다';
      refreshWhereHint(null);
      updateGo();
      return;
    }
    var list = pagesOf(f);
    var opt = nameOpt(f, list.length);
    var names = list.map(function (_, i) { return S.pageName(i + 1, opt); });

    box.innerHTML = '';
    var show = names.length <= 4 ? names : [names[0], names[1], null, names[names.length - 1]];
    show.forEach(function (n, i) {
      if (n === null) {
        var d = document.createElement('span');
        d.className = 'dots';
        d.textContent = ' … (' + (names.length - 3) + '장 줄임) … ';
        box.appendChild(d);
        return;
      }
      var b = document.createElement('b');
      b.textContent = n;
      box.appendChild(b);
      if (i < show.length - 1) box.appendChild(document.createTextNode('  ·  '));
    });

    refreshSizeHint(f);
    refreshWhereHint(f);
    updateGo();
  }

  function refreshSizeHint(f) {
    var s = state.settings;
    var size = { mode: s.sizeMode, dpi: s.dpi, px: s.longPx };
    var plan = S.renderSize(f.ptW, f.ptH, size);
    var pages = totalPages();
    var each = S.guessBytes(plan.pixels, s.quality);
    var text = '첫 쪽 기준 ' + plan.width + ' × ' + plan.height + ' 픽셀 (약 ' + plan.dpi + ' DPI)'
      + '\n한 장에 약 ' + S.fmtBytes(each) + ' · 모두 ' + pages + '장이면 약 ' + S.fmtBytes(each * pages);
    var el = $('sizeHint');
    el.classList.toggle('warn', plan.limited);
    if (plan.limited) {
      text += '\n※ 그림이 너무 커서 ' + plan.dpi + ' DPI 로 줄였습니다. 브라우저가 한 번에 다룰 수 있는 한계입니다.';
    }
    el.textContent = text;
  }

  function refreshWhereHint(f) {
    var s = state.settings;
    var el = $('whereHint');
    var warn = false;
    var text;
    var sub = f && s.subFolder === 'name' ? S.safeName(baseNameFor(f)) + '/' : '';
    if (s.output === 'folder') {
      if (!state.dirHandle) { text = '저장할 폴더를 먼저 골라 주세요.'; warn = true; }
      else text = '→ ' + state.dirHandle.name + '/' + sub
        + (s.onDuplicate === 'overwrite' ? '\n※ 같은 이름이 있으면 덮어씁니다. 원래 파일은 사라집니다.' : '');
      if (s.onDuplicate === 'overwrite') warn = true;
    } else {
      text = f ? '→ ' + zipName() + (sub ? ' 안의 ' + sub : '') + ' 로 내려받습니다' : 'ZIP 파일 하나로 내려받습니다.';
    }
    el.classList.toggle('warn', warn);
    el.textContent = text;
  }

  function zipName() {
    var ok = state.files.filter(function (f) { return f.pages; });
    if (ok.length === 1) return S.safeName(baseNameFor(ok[0])) + '.zip';
    return 'PDF사진_' + ok.length + '개.zip';
  }

  function totalPages() {
    return state.files.reduce(function (n, f) { return n + pagesOf(f).length; }, 0);
  }

  function updateGo() {
    var pages = totalPages();
    var needDir = state.settings.output === 'folder' && !state.dirHandle;
    $('btnGo').disabled = state.running || pages === 0 || needDir;
    if (!state.running) {
      $('runHint').textContent = pages
        ? state.files.filter(function (f) { return f.pages; }).length + '개 PDF · 모두 ' + pages + '장'
          + (needDir ? ' — 저장할 폴더를 골라 주세요' : '')
        : '';
    }
  }

  /* ── PDF 목록 ────────────────────────────────────────────────────── */

  function renderFiles() {
    var ul = $('fileList');
    ul.innerHTML = '';
    state.files.forEach(function (f) {
      var li = document.createElement('li');

      var name = document.createElement('span');
      name.className = 'fname';
      name.textContent = f.name;
      name.title = f.name;
      li.appendChild(name);

      var meta = document.createElement('span');
      meta.className = 'fmeta';
      meta.textContent = S.fmtBytes(f.bytes);
      li.appendChild(meta);

      var st = document.createElement('span');
      st.className = 'fstate ' + (f.error ? 'err' : (f.pages ? 'ok' : ''));
      if (f.error) st.textContent = f.error;
      else if (f.pages) {
        var chosen = pagesOf(f).length;
        st.textContent = chosen === f.pages ? f.pages + '쪽' : chosen + ' / ' + f.pages + '쪽';
      } else st.textContent = '읽는 중…';
      li.appendChild(st);

      var x = document.createElement('button');
      x.className = 'fx';
      x.type = 'button';
      x.textContent = '×';
      x.title = '목록에서 빼기';
      x.addEventListener('click', function () {
        if (state.running) return;
        state.files = state.files.filter(function (o) { return o !== f; });
        renderFiles();
        refreshPreview();
      });
      li.appendChild(x);

      ul.appendChild(li);
    });

    var has = state.files.length > 0;
    ul.hidden = !has;
    $('fileFoot').hidden = !has;
    $('drop').classList.toggle('slim', has);
    var okCount = state.files.filter(function (f) { return f.pages; }).length;
    $('fileSummary').textContent = has
      ? 'PDF ' + state.files.length + '개' + (okCount < state.files.length ? ' (읽은 것 ' + okCount + '개)' : '')
      : '';
  }

  function askPassword(f) {
    return function (msg) { return window.prompt(msg + '\n\n' + f.name, ''); };
  }

  /** 쪽 수를 알아 두려고 한 번 열어 본다 (그리지는 않는다) */
  function probe(f) {
    return Convert.open(f.file, askPassword(f)).then(function (info) {
      f.pages = info.pages;
      f.ptW = info.ptW;
      f.ptH = info.ptH;
      Convert.close(info.doc);
      logLine('info', f.name + ' — ' + info.pages + '쪽');
    }).catch(function (e) {
      f.error = Convert.humanError(e);
      logLine('err', f.name + ' — ' + f.error);
    }).then(function () {
      renderFiles();
      refreshPreview();
    });
  }

  function addFiles(list) {
    var pdfs = list.filter(function (file) { return /\.pdf$/i.test(file.name) || file.type === 'application/pdf'; });
    if (!pdfs.length) { logLine('warn', 'PDF 파일만 넣을 수 있습니다.'); return Promise.resolve(); }
    if (pdfs.length < list.length) logLine('warn', 'PDF 가 아닌 파일 ' + (list.length - pdfs.length) + '개는 뺐습니다.');

    var added = [];
    pdfs.forEach(function (file) {
      /* 같은 파일을 두 번 넣지 않는다 */
      var key = file.name + '|' + file.size + '|' + file.lastModified;
      if (state.files.some(function (f) { return f.key === key; })) return;
      state.seq += 1;
      var f = {
        id: state.seq, key: key, file: file, name: file.name, stem: S.stemOf(file.name),
        bytes: file.size, pages: 0, error: '', ptW: 612, ptH: 792,
      };
      state.files.push(f);
      added.push(f);
    });
    renderFiles();
    /* 한 개씩 차례로 읽는다 — 한꺼번에 열면 큰 PDF 여럿에서 메모리가 튄다 */
    return added.reduce(function (chain, f) {
      return chain.then(function () { return probe(f); });
    }, Promise.resolve());
  }

  /* ── 고르기 ──────────────────────────────────────────────────────── */

  $('btnPick').addEventListener('click', function () { $('filePick').click(); });
  $('filePick').addEventListener('change', function () {
    addFiles(Array.prototype.slice.call(this.files || []));
    this.value = '';
  });

  $('btnClear').addEventListener('click', function () {
    if (state.running) return;
    state.files = [];
    renderFiles();
    refreshPreview();
  });

  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) {
    if (state.running) return;
    addFiles(Array.prototype.slice.call(e.dataTransfer.files || []));
  });
  /* 창 아무 데나 놓아도 브라우저가 그 PDF 를 열어 버리지 않게 — 놓은 PDF 는 목록에 올린다 */
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault();
    if (state.running || drop.contains(e.target)) return;
    addFiles(Array.prototype.slice.call(e.dataTransfer.files || []));
  });

  /* ── 설정 손잡이들 ───────────────────────────────────────────────── */

  $('customBase').addEventListener('input', function () { saveSettings({ customBase: this.value }); });
  $('sep').addEventListener('change', function () { saveSettings({ sep: this.value }); });
  $('start').addEventListener('input', function () { saveSettings({ start: Number(this.value) || 0 }); });
  $('digits').addEventListener('change', function () {
    saveSettings({ digits: this.value === 'auto' ? 'auto' : Number(this.value) });
  });
  $('omitWhenSingle').addEventListener('change', function () { saveSettings({ omitWhenSingle: this.checked }); });
  $('subFolder').addEventListener('change', function () { saveSettings({ subFolder: this.checked ? 'name' : '' }); });
  $('onDuplicate').addEventListener('change', function () { saveSettings({ onDuplicate: this.value }); });
  $('dpi').addEventListener('change', function () { saveSettings({ dpi: Number(this.value) }); });
  $('longPx').addEventListener('change', function () { saveSettings({ longPx: Number(this.value) }); });
  $('quality').addEventListener('change', function () { saveSettings({ quality: this.value }); });
  $('range').addEventListener('input', function () {
    saveSettings({ range: this.value });
    renderFiles();
  });

  $('btnPickFolder').addEventListener('click', function () {
    window.showDirectoryPicker({ id: 'pdf-to-jpg', mode: 'readwrite' }).then(function (h) {
      state.dirHandle = h;
      refreshWhere();
      refreshPreview();
      logLine('info', '저장 폴더: ' + h.name);
    }).catch(function (e) {
      if (e && e.name !== 'AbortError') logLine('err', '폴더를 열지 못했습니다: ' + e.message);
    });
  });

  window.addEventListener('beforeunload', function (e) {
    if (state.running) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ── 내보내는 곳 두 가지 ─────────────────────────────────────────── */

  /** ZIP 으로: 모아 두었다가 끝에 한 번 내려받는다 */
  function zipSink() {
    var z = Zip();
    return {
      begin: function (folder) { return Promise.resolve(folder ? folder + '/' : ''); },
      write: function (prefix, name, blob) {
        return z.add(prefix + name, blob).then(function (path) {
          return { name: path.split('/').pop(), skipped: false };
        });
      },
      end: function () {
        if (!z.count) return null;
        var blob = z.finish();
        var name = zipName();
        state.lastZip = { blob: blob, name: name };
        Zip.download(blob, name);
        return name;
      },
    };
  }

  /** 폴더로: 고른 폴더에 한 장씩 바로 쓴다 */
  function folderSink(root) {
    var dup = state.settings.onDuplicate;
    function exists(dir, name) {
      return dir.getFileHandle(name).then(function () { return true; }, function () { return false; });
    }
    return {
      begin: function (folder) {
        return folder ? root.getDirectoryHandle(folder, { create: true }) : Promise.resolve(root);
      },
      write: function (dir, name, blob) {
        return exists(dir, name).then(function (has) {
          if (has && dup === 'skip') return { name: name, skipped: true };
          if (!has || dup === 'overwrite') return put(dir, name, blob);
          var n = 2;
          function next() {
            var cand = S.bumpName(name, n++);
            return exists(dir, cand).then(function (h) { return h ? next() : put(dir, cand, blob); });
          }
          return next();
        });
      },
      end: function () { return root.name; },
    };
    function put(dir, name, blob) {
      return dir.getFileHandle(name, { create: true }).then(function (fh) {
        return fh.createWritable();
      }).then(function (w) {
        return w.write(blob).then(function () { return w.close(); });
      }).then(function () { return { name: name, skipped: false }; });
    }
  }

  function ensurePermission(h) {
    if (!h.queryPermission) return Promise.resolve(true);
    return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
      if (p === 'granted') return true;
      return h.requestPermission({ mode: 'readwrite' }).then(function (q) { return q === 'granted'; });
    });
  }

  /* ── 바꾸기 ──────────────────────────────────────────────────────── */

  function setProgress(done, total, text) {
    $('progWrap').hidden = false;
    $('progFill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    $('progText').textContent = text;
  }

  function lockUi(on) {
    state.running = on;
    $('btnGo').hidden = on;
    $('btnStop').hidden = !on;
    ['btnPick', 'btnClear', 'btnPickFolder', 'customBase', 'sep', 'start', 'digits',
      'omitWhenSingle', 'subFolder', 'onDuplicate', 'dpi', 'longPx', 'quality', 'range']
      .forEach(function (id) { $(id).disabled = on; });
    updateGo();
  }

  $('btnStop').addEventListener('click', function () {
    state.stopping = true;
    $('btnStop').disabled = true;
    $('progText').textContent = '멈추는 중… (그리던 쪽까지만 담습니다)';
  });

  $('btnGo').addEventListener('click', function () { run(); });

  function run() {
    var todo = state.files.filter(function (f) { return f.pages && !f.error; });
    if (!todo.length || state.running) return;

    var s = state.settings;
    var totals = todo.reduce(function (n, f) { return n + pagesOf(f).length; }, 0);
    if (!totals) return;

    var toFolder = s.output === 'folder';
    if (toFolder && s.onDuplicate === 'overwrite'
      && !window.confirm('같은 이름이 있으면 덮어쓰기로 되어 있습니다.\n원래 파일은 사라집니다. 그대로 할까요?')) return;

    var ready = toFolder ? ensurePermission(state.dirHandle) : Promise.resolve(true);
    ready.then(function (ok) {
      if (!ok) { logLine('err', '폴더에 쓸 권한을 받지 못했습니다.'); return; }
      go(todo, totals, toFolder ? folderSink(state.dirHandle) : zipSink());
    });
  }

  function go(todo, totals, sink) {
    state.stopping = false;
    $('btnStop').disabled = false;
    lockUi(true);
    $('cardResult').hidden = true;
    clearThumbs();
    var startedAt = Date.now();
    var done = 0;
    var made = 0;
    var skipped = 0;
    var failed = 0;
    var thumbs = [];

    setProgress(0, totals, '준비 중…');

    var chain = Promise.resolve();
    todo.forEach(function (f) {
      chain = chain.then(function () {
        if (state.stopping) return null;
        return convertOne(f, sink, function (info) {
          done += 1;
          if (info.skipped) skipped += 1;
          else { made += 1; if (thumbs.length < 8) thumbs.push(info); }
          setProgress(done, totals,
            f.name + ' — ' + info.pageNo + '쪽 / ' + f.pages + '쪽  ·  전체 ' + done + ' / ' + totals + '장');
        }).catch(function (e) {
          failed += 1;
          logLine('err', f.name + ' — ' + Convert.humanError(e));
        });
      });
    });

    chain.then(function () {
      setProgress(totals, totals, '마무리하는 중…');
      return sink.end();
    }).then(function (where) {
      Convert.release();
      lockUi(false);
      $('progWrap').hidden = true;

      var secs = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      var parts = ['<b>' + made + '장</b>을 만들었습니다'];
      if (skipped) parts.push(skipped + '장은 같은 이름이 있어 건너뛰었습니다');
      if (failed) parts.push(failed + '개 PDF 는 실패했습니다');
      if (state.stopping) parts.push('중간에 멈췄습니다');
      parts.push(secs + '초 걸림');
      if (where) parts.push(state.settings.output === 'folder' ? '저장한 곳: ' + esc(where) : '받은 파일: ' + esc(where));

      $('resultText').innerHTML = parts.join(' · ');
      showThumbs(thumbs);
      $('cardResult').hidden = false;
      $('btnOpenResult').hidden = state.settings.output === 'folder' || !state.lastZip;
      $('runHint').textContent = '';
      if (made) logLine('ok', made + '장 완료' + (where ? ' — ' + where : ''));
      updateGo();
    }).catch(function (e) {
      Convert.release();
      lockUi(false);
      $('progWrap').hidden = true;
      logLine('err', '저장하지 못했습니다: ' + ((e && e.message) || e));
    });
  }

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  $('btnOpenResult').addEventListener('click', function () {
    if (state.lastZip) Zip.download(state.lastZip.blob, state.lastZip.name);
  });

  /** PDF 하나를 쪽 순서대로 굽는다 */
  function convertOne(f, sink, onPage) {
    var s = state.settings;
    var list = pagesOf(f);
    var opt = nameOpt(f, list.length);
    var folder = s.subFolder === 'name' ? S.safeName(baseNameFor(f)) : '';
    var target = null;
    var docRef = null;

    return sink.begin(folder).then(function (t) {
      target = t;
      return Convert.open(f.file, askPassword(f));
    }).then(function (info) {
      docRef = info.doc;
      var size = { mode: s.sizeMode, dpi: s.dpi, px: s.longPx };

      /* 쪽을 하나씩 차례로 — 이래야 순서가 어긋나지 않고 메모리도 얌전하다 */
      return list.reduce(function (chain, pageNo, idx) {
        return chain.then(function () {
          if (state.stopping) return null;
          var wanted = S.pageName(idx + 1, opt);
          return Convert.renderPage(docRef, pageNo, { size: size, quality: s.quality })
            .then(function (img) {
              return sink.write(target, wanted, img.blob).then(function (w) {
                onPage({ pageNo: pageNo, name: w.name, skipped: w.skipped, blob: img.blob });
              });
            });
        });
      }, Promise.resolve());
    }).then(function () {
      Convert.close(docRef);
      logLine('ok', f.name + ' — 끝');
    }).catch(function (e) {
      Convert.close(docRef);
      throw e;
    });
  }

  function clearThumbs() {
    state.thumbUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    state.thumbUrls = [];
    $('thumbs').innerHTML = '';
  }

  function showThumbs(items) {
    var box = $('thumbs');
    box.innerHTML = '';
    items.forEach(function (i) {
      var url = URL.createObjectURL(i.blob);
      state.thumbUrls.push(url);
      var fig = document.createElement('figure');
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      var img = document.createElement('img');
      img.src = url;
      img.alt = i.name;
      img.title = i.name + ' — 눌러서 크게 보기';
      a.appendChild(img);
      var cap = document.createElement('figcaption');
      cap.textContent = i.name;
      fig.appendChild(a);
      fig.appendChild(cap);
      box.appendChild(fig);
    });
  }

  /* ── 켜기 ────────────────────────────────────────────────────────── */

  applySettings();
  logLine('info', '준비됐습니다. 파일은 이 브라우저 안에서만 처리됩니다.');
  if (!CAN_FOLDER) logLine('info', '이 브라우저는 폴더에 바로 저장을 지원하지 않아 ZIP 으로 받습니다.');

  /* pdf.js 를 미리 불러 둔다 — 첫 변환이 기다리지 않게 */
  Convert.ready().then(function () {
    logLine('ok', 'PDF 처리기 준비 완료');
  }).catch(function (e) {
    logLine('err', 'PDF 처리기를 불러오지 못했습니다: ' + Convert.humanError(e));
  });
}());
