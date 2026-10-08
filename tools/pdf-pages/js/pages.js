/* PDF 쪽 편집 — 합치기 · 나누기 · 돌리기 · 지우기 · 순서 바꾸기 · 사진을 PDF 로.
 *
 * 화면에 늘어선 "쪽" 하나하나는 {어느 파일의, 몇 번째 쪽을, 얼마나 더 돌려서} 라는 표일 뿐이다.
 * 원본은 끝까지 그대로 두고, 저장할 때만 pdf-lib 로 그 표대로 새 PDF 를 엮는다.
 * 그래서 몇 번을 고쳐도 화질이 떨어지지 않고, 되돌리기도 표만 되돌리면 된다.
 *
 *   보기 그림(작은 쪽 그림) — pdf.js  (tools/common/pdfjs)
 *   새 PDF 엮기             — pdf-lib (tools/common/pdf-lib)
 *
 * 파일은 이 브라우저 밖으로 나가지 않는다.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var PDFLib = window.PDFLib;

  var COLORS = ['#c0392b', '#2e5bdb', '#1e8f5a', '#b7791f', '#7b4fd6', '#d9480f', '#0b7285', '#a61e4d'];
  var THUMB_LONG = 300;            // 보기 그림의 긴 변 (작게 그려야 빠르다)
  var A4 = [595.28, 841.89];       // pt

  var state = {
    sources: [],     // {id, name, stem, kind:'pdf'|'image', file, color, pages, error, view, lib}
    pages: [],       // {key, src, index, rot}
    sel: {},         // key → true
    lastClicked: null,
    undo: [],
    seq: 0,
    busy: false,
    mode: 'merge',
  };

  /* ── 작은 도구 ───────────────────────────────────────────────────── */

  function logLine(level, text) {
    var box = $('log');
    var div = document.createElement('div');
    var cls = { ok: 'l-ok', warn: 'l-warn', err: 'l-err' }[level] || '';
    if (cls) div.className = cls;
    var t = new Date();
    div.textContent = [t.getHours(), t.getMinutes(), t.getSeconds()]
      .map(function (n) { return String(n).padStart(2, '0'); }).join(':') + '  ' + text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function safeName(s, fallback) {
    var out = String(s == null ? '' : s)
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ').trim()
      .replace(/^\.+/, '').replace(/[. ]+$/, '').slice(0, 80).trim();
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(out)) out += '_';
    return out || fallback || '문서';
  }

  function stemOf(name) { return String(name).replace(/\.[A-Za-z0-9]{1,5}$/, ''); }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  function isPdf(f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; }
  function isImage(f) { return /^image\/(jpeg|png|webp|gif|bmp)$/.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name); }

  function srcOf(id) { return state.sources.find(function (s) { return s.id === id; }); }

  /* ── pdf.js 불러오기 ─────────────────────────────────────────────── */

  var pdfjs = null;
  var pdfjsLoading = null;
  function at(rel) { return new URL(rel, document.baseURI).href; }
  function viewer() {
    if (pdfjs) return Promise.resolve(pdfjs);
    if (!pdfjsLoading) {
      pdfjsLoading = import(at('../common/pdfjs/pdf.min.mjs')).then(function (mod) {
        mod.GlobalWorkerOptions.workerSrc = at('../common/pdfjs/pdf.worker.min.mjs');
        pdfjs = mod;
        return mod;
      });
    }
    return pdfjsLoading;
  }

  /* ── 파일 넣기 ───────────────────────────────────────────────────── */

  function addFiles(list) {
    var ok = list.filter(function (f) { return isPdf(f) || isImage(f); });
    if (ok.length < list.length) logLine('warn', 'PDF·사진이 아닌 파일 ' + (list.length - ok.length) + '개는 뺐습니다.');
    if (!ok.length) return Promise.resolve();
    pushUndo();
    return ok.reduce(function (chain, file) {
      return chain.then(function () { return addOne(file); });
    }, Promise.resolve()).then(function () {
      if (!$('outName').value.trim() && state.sources.length) {
        var first = state.sources.find(function (s) { return !s.error; });
        if (first) $('outName').value = first.stem + (state.sources.length > 1 ? '_합침' : '_편집');
      }
      render();
    });
  }

  function addOne(file) {
    state.seq += 1;
    var src = {
      id: 's' + state.seq, name: file.name, stem: stemOf(file.name), file: file,
      kind: isPdf(file) ? 'pdf' : 'image', color: COLORS[state.sources.length % COLORS.length],
      pages: 0, error: '', view: null, lib: null,
    };
    state.sources.push(src);
    renderSources();

    var opened = src.kind === 'pdf' ? openPdf(src) : openImage(src);
    return opened.then(function () {
      for (var i = 0; i < src.pages; i++) {
        state.seq += 1;
        state.pages.push({ key: 'p' + state.seq, src: src.id, index: i, rot: 0 });
      }
      logLine('info', src.name + ' — ' + (src.kind === 'pdf' ? src.pages + '쪽' : '사진 1장'));
    }).catch(function (e) {
      src.error = e.message || String(e);
      logLine('err', src.name + ' — ' + src.error);
    }).then(function () {
      renderSources();
      render();
    });
  }

  function openPdf(src) {
    return src.file.arrayBuffer().then(function (buf) {
      src.bytes = new Uint8Array(buf);
      /* 엮을 때 쓸 pdf-lib 문서를 먼저 열어 본다 — 암호가 걸렸거나 깨진 것을 여기서 걸러 낸다 */
      return PDFLib.PDFDocument.load(src.bytes, { updateMetadata: false }).catch(function (e) {
        if (/encrypt/i.test(e && e.message)) throw new Error('암호가 걸린 PDF 라 다룰 수 없습니다');
        throw new Error('PDF 를 읽지 못했습니다 (깨졌거나 PDF 가 아닙니다)');
      });
    }).then(function (lib) {
      src.lib = lib;
      src.pages = lib.getPageCount();
      if (!src.pages) throw new Error('쪽이 하나도 없습니다');
      return viewer().then(function (mod) {
        /* pdf.js 는 자기가 받은 버퍼를 일꾼에게 넘기며 비워 버린다 — 사본을 준다 */
        return mod.getDocument({
          data: src.bytes.slice(),
          isEvalSupported: false,
          cMapUrl: at('../common/pdfjs/cmaps/'), cMapPacked: true,
          standardFontDataUrl: at('../common/pdfjs/standard_fonts/'),
          wasmUrl: at('../common/pdfjs/wasm/'),
        }).promise;
      }).then(function (doc) { src.view = doc; }, function () { src.view = null; /* 보기만 못 할 뿐 엮기는 된다 */ });
    });
  }

  function openImage(src) {
    return createImageBitmap(src.file, { imageOrientation: 'from-image' }).catch(function () {
      return createImageBitmap(src.file);
    }).then(function (bmp) {
      src.bmp = bmp;
      src.pages = 1;
    }, function () {
      throw new Error('사진을 열지 못했습니다 (이 브라우저가 못 여는 형식입니다)');
    });
  }

  /* ── 보기 그림 ───────────────────────────────────────────────────── */

  var thumbCache = {};       // key|rot → dataURL
  var thumbQueue = Promise.resolve();

  function thumbFor(pg) {
    var ck = pg.src + '|' + pg.index + '|' + pg.rot;
    if (thumbCache[ck]) return Promise.resolve(thumbCache[ck]);
    var src = srcOf(pg.src);
    /* 한 번에 하나씩 그린다 — 수백 쪽을 한꺼번에 그리면 브라우저가 멈칫한다 */
    var job = thumbQueue.then(function () {
      if (thumbCache[ck]) return thumbCache[ck];
      return (src.kind === 'pdf' ? pdfThumb(src, pg) : imageThumb(src, pg)).then(function (url) {
        thumbCache[ck] = url;
        return url;
      });
    });
    thumbQueue = job.catch(function () {});
    return job;
  }

  function pdfThumb(src, pg) {
    if (!src.view) return Promise.resolve('');
    return src.view.getPage(pg.index + 1).then(function (page) {
      var rotation = (page.rotate + pg.rot) % 360;
      var base = page.getViewport({ scale: 1, rotation: rotation });
      var scale = THUMB_LONG / Math.max(base.width, base.height);
      var vp = page.getViewport({ scale: scale, rotation: rotation });
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(vp.width));
      cv.height = Math.max(1, Math.round(vp.height));
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
        page.cleanup();
        return cv.toDataURL('image/jpeg', 0.8);
      });
    });
  }

  function imageThumb(src, pg) {
    var b = src.bmp;
    var k = THUMB_LONG / Math.max(b.width, b.height);
    var w = Math.max(1, Math.round(b.width * k));
    var h = Math.max(1, Math.round(b.height * k));
    var turned = pg.rot % 180 !== 0;
    var cv = document.createElement('canvas');
    cv.width = turned ? h : w;
    cv.height = turned ? w : h;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.rotate(pg.rot * Math.PI / 180);
    ctx.drawImage(b, -w / 2, -h / 2, w, h);
    return Promise.resolve(cv.toDataURL('image/jpeg', 0.8));
  }

  /* ── 그리기 ──────────────────────────────────────────────────────── */

  function renderSources() {
    var ul = $('srcList');
    ul.innerHTML = '';
    state.sources.forEach(function (s) {
      var li = document.createElement('li');
      var c = document.createElement('span');
      c.className = 'fcolor';
      c.style.background = s.color;
      li.appendChild(c);
      var n = document.createElement('span');
      n.className = 'fname';
      n.textContent = s.name;
      li.appendChild(n);
      var m = document.createElement('span');
      m.className = 'fmeta';
      m.textContent = fmtBytes(s.file.size);
      li.appendChild(m);
      var st = document.createElement('span');
      st.className = 'fstate ' + (s.error ? 'err' : (s.pages ? 'ok' : ''));
      st.textContent = s.error || (s.pages ? (s.kind === 'pdf' ? s.pages + '쪽' : '사진') : '읽는 중…');
      li.appendChild(st);
      var x = document.createElement('button');
      x.className = 'fx';
      x.type = 'button';
      x.textContent = '×';
      x.title = '이 파일의 쪽을 모두 빼기';
      x.onclick = function () { removeSource(s.id); };
      li.appendChild(x);
      ul.appendChild(li);
    });
    ul.hidden = !state.sources.length;
    $('drop').classList.toggle('slim', state.sources.length > 0);
  }

  function render() {
    var board = $('board');
    board.innerHTML = '';
    state.pages.forEach(function (pg, i) {
      var src = srcOf(pg.src);
      var el = document.createElement('div');
      el.className = 'pg' + (state.sel[pg.key] ? ' sel' : '');
      el.draggable = true;
      el.dataset.key = pg.key;
      el.tabIndex = 0;
      el.style.borderBottomColor = state.sel[pg.key] ? '' : src.color;

      var frame = document.createElement('div');
      frame.className = 'frame';
      var wait = document.createElement('span');
      wait.className = 'wait';
      wait.textContent = '그리는 중…';
      frame.appendChild(wait);
      el.appendChild(frame);
      thumbFor(pg).then(function (url) {
        if (!url) { wait.textContent = '보기 그림 없음'; return; }
        var img = document.createElement('img');
        img.src = url;
        img.alt = (i + 1) + '쪽';
        img.draggable = false;
        frame.innerHTML = '';
        frame.appendChild(img);
      }).catch(function () { wait.textContent = '그리지 못함'; });

      if (pg.rot) {
        var r = document.createElement('span');
        r.className = 'badge-rot';
        r.textContent = '↻' + pg.rot + '°';
        el.appendChild(r);
      }

      var cap = document.createElement('div');
      cap.className = 'cap';
      cap.innerHTML = '<span class="no"></span><span class="src"></span>';
      cap.firstChild.textContent = (i + 1);
      cap.lastChild.textContent = src.kind === 'pdf' ? src.stem + ' · ' + (pg.index + 1) + '쪽' : src.stem;
      cap.lastChild.style.color = src.color;
      el.appendChild(cap);

      var acts = document.createElement('div');
      acts.className = 'acts';
      acts.innerHTML = '<button type="button" data-a="left" title="왼쪽으로 돌리기">↺</button>'
        + '<button type="button" data-a="right" title="오른쪽으로 돌리기">↻</button>'
        + '<button type="button" data-a="del" class="x" title="이 쪽 빼기">×</button>';
      el.appendChild(acts);

      board.appendChild(el);
    });

    var n = state.pages.length;
    var selN = selectedKeys().length;
    $('empty').hidden = n > 0;
    $('pageCount').textContent = n ? '모두 ' + n + '쪽' + (selN ? ' · ' + selN + '쪽 고름' : '') : '';
    $('btnUndo').disabled = !state.undo.length;
    $('onlySel').disabled = !selN;
    if (!selN) $('onlySel').checked = false;
    refreshSave();
  }

  function selectedKeys() {
    return state.pages.filter(function (p) { return state.sel[p.key]; }).map(function (p) { return p.key; });
  }

  /* ── 고치기 (모두 되돌릴 수 있다) ───────────────────────────────── */

  function pushUndo() {
    state.undo.push({
      pages: state.pages.map(function (p) { return Object.assign({}, p); }),
      sources: state.sources.slice(),
    });
    if (state.undo.length > 60) state.undo.shift();
  }

  function undo() {
    var last = state.undo.pop();
    if (!last) return;
    state.pages = last.pages;
    state.sources = last.sources;
    state.sel = {};
    renderSources();
    render();
  }

  function targets(key) {
    if (key) return [key];
    return selectedKeys();
  }

  function rotate(keys, by) {
    if (!keys.length) { logLine('warn', '먼저 쪽을 골라 주세요.'); return; }
    pushUndo();
    state.pages.forEach(function (p) {
      if (keys.indexOf(p.key) >= 0) p.rot = ((p.rot + by) % 360 + 360) % 360;
    });
    render();
  }

  function remove(keys) {
    if (!keys.length) { logLine('warn', '먼저 쪽을 골라 주세요.'); return; }
    pushUndo();
    state.pages = state.pages.filter(function (p) { return keys.indexOf(p.key) < 0; });
    keys.forEach(function (k) { delete state.sel[k]; });
    render();
  }

  function duplicate(keys) {
    if (!keys.length) { logLine('warn', '먼저 쪽을 골라 주세요.'); return; }
    pushUndo();
    var out = [];
    state.pages.forEach(function (p) {
      out.push(p);
      if (keys.indexOf(p.key) >= 0) {
        state.seq += 1;
        out.push(Object.assign({}, p, { key: 'p' + state.seq }));
      }
    });
    state.pages = out;
    render();
  }

  function removeSource(id) {
    pushUndo();
    state.pages = state.pages.filter(function (p) { return p.src !== id; });
    state.sources = state.sources.filter(function (s) { return s.id !== id; });
    renderSources();
    render();
  }

  /** 끌어 놓은 쪽(들)을 target 앞/뒤로 옮긴다 */
  function moveKeys(keys, targetKey, after) {
    if (keys.indexOf(targetKey) >= 0) return;
    pushUndo();
    var moving = state.pages.filter(function (p) { return keys.indexOf(p.key) >= 0; });
    var rest = state.pages.filter(function (p) { return keys.indexOf(p.key) < 0; });
    var at = rest.findIndex(function (p) { return p.key === targetKey; });
    if (at < 0) at = rest.length; else if (after) at += 1;
    state.pages = rest.slice(0, at).concat(moving, rest.slice(at));
    render();
  }

  /* ── 판 위의 손놀림 ──────────────────────────────────────────────── */

  var board = $('board');

  board.addEventListener('click', function (e) {
    var el = e.target.closest('.pg');
    if (!el) return;
    var key = el.dataset.key;
    var a = e.target.closest('button[data-a]');
    if (a) {
      if (a.dataset.a === 'left') rotate([key], -90);
      else if (a.dataset.a === 'right') rotate([key], 90);
      else if (a.dataset.a === 'del') remove([key]);
      return;
    }
    if (e.shiftKey && state.lastClicked) {
      var keys = state.pages.map(function (p) { return p.key; });
      var i = keys.indexOf(state.lastClicked);
      var j = keys.indexOf(key);
      if (i >= 0 && j >= 0) {
        for (var k = Math.min(i, j); k <= Math.max(i, j); k++) state.sel[keys[k]] = true;
      }
    } else if (state.sel[key]) delete state.sel[key];
    else state.sel[key] = true;
    state.lastClicked = key;
    render();
  });

  var dragKeys = null;
  board.addEventListener('dragstart', function (e) {
    var el = e.target.closest('.pg');
    if (!el) return;
    var key = el.dataset.key;
    dragKeys = state.sel[key] ? selectedKeys() : [key];
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', key); } catch (_) {}
    setTimeout(function () {
      Array.prototype.forEach.call(board.children, function (c) {
        if (dragKeys && dragKeys.indexOf(c.dataset.key) >= 0) c.classList.add('dragging');
      });
    }, 0);
  });
  function clearMarks() {
    Array.prototype.forEach.call(board.querySelectorAll('.drop-before,.drop-after'), function (c) {
      c.classList.remove('drop-before', 'drop-after');
    });
  }
  board.addEventListener('dragover', function (e) {
    if (!dragKeys) return;
    var el = e.target.closest('.pg');
    e.preventDefault();
    clearMarks();
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.classList.add(e.clientX > r.left + r.width / 2 ? 'drop-after' : 'drop-before');
  });
  board.addEventListener('drop', function (e) {
    if (!dragKeys) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target.closest('.pg');
    var keys = dragKeys;
    dragKeys = null;
    clearMarks();
    if (el) {
      var r = el.getBoundingClientRect();
      moveKeys(keys, el.dataset.key, e.clientX > r.left + r.width / 2);
    } else render();
  });
  board.addEventListener('dragend', function () {
    dragKeys = null;
    clearMarks();
    Array.prototype.forEach.call(board.querySelectorAll('.dragging'), function (c) { c.classList.remove('dragging'); });
  });

  $('toolbar').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b || state.busy) return;
    var act = b.dataset.act;
    if (act === 'all') { state.pages.forEach(function (p) { state.sel[p.key] = true; }); render(); }
    else if (act === 'none') { state.sel = {}; render(); }
    else if (act === 'left') rotate(targets(), -90);
    else if (act === 'right') rotate(targets(), 90);
    else if (act === 'dup') duplicate(targets());
    else if (act === 'del') remove(targets());
    else if (act === 'reverse') { pushUndo(); state.pages.reverse(); render(); }
    else if (act === 'undo') undo();
    else if (act === 'clear') {
      if (!state.pages.length || !window.confirm('넣은 파일과 쪽을 모두 비울까요?')) return;
      pushUndo();
      state.pages = [];
      state.sources = [];
      state.sel = {};
      renderSources();
      render();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && state.pages.length) {
      e.preventDefault();
      state.pages.forEach(function (p) { state.sel[p.key] = true; });
      render();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeys().length) {
      e.preventDefault();
      remove(selectedKeys());
    }
  });

  /* ── 파일 고르기 · 끌어다 놓기 ───────────────────────────────────── */

  $('btnPick').addEventListener('click', function () { $('filePick').click(); });
  $('filePick').addEventListener('change', function () {
    addFiles(Array.prototype.slice.call(this.files || []));
    this.value = '';
  });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { if (dragKeys) return; e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function () { drop.classList.remove('over'); });
  });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) {
    e.preventDefault();
    if (dragKeys || state.busy) return;
    var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
    if (files.length) addFiles(files);
  });

  /* ── 저장 설정 ───────────────────────────────────────────────────── */

  Array.prototype.forEach.call($('segMode').querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      state.mode = b.dataset.v;
      Array.prototype.forEach.call($('segMode').querySelectorAll('button'), function (x) {
        x.classList.toggle('on', x === b);
      });
      $('rowChunk').hidden = state.mode !== 'chunk';
      $('rowRanges').hidden = state.mode !== 'ranges';
      refreshSave();
    });
  });
  ['chunk', 'ranges', 'outName', 'onlySel'].forEach(function (id) {
    $(id).addEventListener(id === 'onlySel' ? 'change' : 'input', refreshSave);
  });

  function savingPages() {
    var list = state.pages;
    if ($('onlySel').checked) list = list.filter(function (p) { return state.sel[p.key]; });
    return list;
  }

  /** "1-3; 4-6; 7, 9-" → [[0,1,2],[3,4,5],[6,8,9…]] (0부터 세는 자리) */
  function parseRanges(text, total) {
    var groups = [];
    var bad = [];
    String(text || '').split(/[;\n]/).forEach(function (part) {
      var picked = [];
      part.split(',').forEach(function (tok) {
        var t = tok.replace(/\s+/g, '');
        if (!t) return;
        var m = /^(\d*)[-~](\d*)$/.exec(t);
        var a; var b;
        if (m) { a = m[1] ? Number(m[1]) : 1; b = m[2] ? Number(m[2]) : total; }
        else if (/^\d+$/.test(t)) { a = b = Number(t); }
        else { bad.push(t); return; }
        if (a > b) { var tmp = a; a = b; b = tmp; }
        for (var n = Math.max(1, a); n <= Math.min(total, b); n++) picked.push(n - 1);
      });
      if (picked.length) groups.push(picked);
    });
    return { groups: groups, bad: bad };
  }

  /** 저장 방식에 따라 "어떤 쪽들로 PDF 몇 개를 만들까" */
  function plan() {
    var list = savingPages();
    if (!list.length) return { outputs: [], why: '저장할 쪽이 없습니다' };
    if (state.mode === 'merge') return { outputs: [list] };
    if (state.mode === 'each') return { outputs: list.map(function (p) { return [p]; }) };
    if (state.mode === 'chunk') {
      var k = Math.max(1, Math.floor(Number($('chunk').value) || 1));
      var outs = [];
      for (var i = 0; i < list.length; i += k) outs.push(list.slice(i, i + k));
      return { outputs: outs };
    }
    var r = parseRanges($('ranges').value, list.length);
    if (r.bad.length) return { outputs: [], why: '알아볼 수 없는 범위: ' + r.bad.join(', ') };
    if (!r.groups.length) return { outputs: [], why: '나눌 범위를 적어 주세요 (예: 1-3; 4-6)' };
    return { outputs: r.groups.map(function (g) { return g.map(function (i) { return list[i]; }); }) };
  }

  function refreshSave() {
    var p = plan();
    var n = p.outputs.length;
    $('btnSave').disabled = state.busy || !n;
    $('btnSave').textContent = n > 1 ? 'PDF ' + n + '개로 저장 (ZIP)' : 'PDF 로 저장';
    var pages = p.outputs.reduce(function (s, o) { return s + o.length; }, 0);
    $('saveHint').textContent = n ? (n > 1 ? n + '개 파일 · 모두 ' + pages + '쪽' : pages + '쪽짜리 PDF 하나') : (state.pages.length ? p.why || '' : '');
  }

  /* ── 엮기 ────────────────────────────────────────────────────────── */

  function setProgress(done, total, text) {
    $('progWrap').hidden = false;
    $('progFill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    $('progText').textContent = text;
  }

  /** 사진을 PDF 에 넣을 수 있는 JPG/PNG 바이트로 (사진 방향을 반영해 다시 굽는다) */
  var imgBytesCache = {};
  function imageBytes(src) {
    if (imgBytesCache[src.id]) return Promise.resolve(imgBytesCache[src.id]);
    var png = /png|gif/i.test(src.file.type) || /\.(png|gif)$/i.test(src.name);
    var cv = document.createElement('canvas');
    cv.width = src.bmp.width;
    cv.height = src.bmp.height;
    var ctx = cv.getContext('2d');
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
    ctx.drawImage(src.bmp, 0, 0);
    return new Promise(function (resolve, reject) {
      cv.toBlob(function (b) {
        if (!b) { reject(new Error(src.name + ' 사진을 굽지 못했습니다')); return; }
        b.arrayBuffer().then(function (buf) {
          var out = { png: png, bytes: new Uint8Array(buf), w: cv.width, h: cv.height };
          imgBytesCache[src.id] = out;
          resolve(out);
        });
      }, png ? 'image/png' : 'image/jpeg', 0.92);
    });
  }

  function addImagePage(doc, src, rot) {
    return imageBytes(src).then(function (im) {
      return (im.png ? doc.embedPng(im.bytes) : doc.embedJpg(im.bytes)).then(function (emb) {
        var how = $('imgPage').value;
        var w = im.w * 0.75;               // 96dpi 로 보고 pt 로
        var h = im.h * 0.75;
        var pw = w; var ph = h; var margin = 0;
        if (how !== 'image') {
          /* 종이는 사진 모양대로 세우거나 눕힌다. 돌리기는 아래에서 쪽째로 한다. */
          var landscape = w > h;
          pw = landscape ? A4[1] : A4[0];
          ph = landscape ? A4[0] : A4[1];
          margin = how === 'a4' ? 24 : 0;
          var k = Math.min((pw - margin * 2) / w, (ph - margin * 2) / h);
          w *= k; h *= k;
        }
        var page = doc.addPage([pw, ph]);
        page.drawImage(emb, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
        if (rot) page.setRotation(PDFLib.degrees(rot));
      });
    });
  }

  /** 쪽 목록 하나 → 새 PDF 바이트 */
  function build(list) {
    var doc;
    return PDFLib.PDFDocument.create().then(function (d) {
      doc = d;
      doc.setProducer('교실 도구함 — PDF 쪽 편집');
      doc.setCreator('gg-web-cmd.github.io/tools');

      /* 같은 파일에서 오는 쪽은 한 번에 옮겨야 글꼴·그림이 겹쳐 들어가지 않는다 */
      var bySrc = {};
      list.forEach(function (p) {
        var s = srcOf(p.src);
        if (s.kind === 'pdf') (bySrc[s.id] = bySrc[s.id] || []).push(p);
      });
      var copied = {};      // page key → PDFPage
      return Object.keys(bySrc).reduce(function (chain, id) {
        return chain.then(function () {
          var ps = bySrc[id];
          return doc.copyPages(srcOf(id).lib, ps.map(function (p) { return p.index; })).then(function (pages) {
            pages.forEach(function (pg, i) { copied[ps[i].key + '#' + i] = pg; ps[i]._copy = ps[i].key + '#' + i; });
          });
        });
      }, Promise.resolve()).then(function () {
        return list.reduce(function (chain, p) {
          return chain.then(function () {
            var s = srcOf(p.src);
            if (s.kind === 'image') return addImagePage(doc, s, p.rot);
            var pg = copied[p._copy];
            var base = pg.getRotation().angle || 0;
            pg.setRotation(PDFLib.degrees(((base + p.rot) % 360 + 360) % 360));
            doc.addPage(pg);
            return null;
          });
        }, Promise.resolve());
      });
    }).then(function () {
      return doc.save();
    });
  }

  $('btnSave').addEventListener('click', function () {
    var p = plan();
    if (!p.outputs.length || state.busy) return;
    var name = safeName($('outName').value, '문서');
    state.busy = true;
    refreshSave();
    var started = Date.now();
    var zip = p.outputs.length > 1 ? Zip() : null;
    var digits = String(p.outputs.length).length < 2 ? 2 : String(p.outputs.length).length;
    var single = null;

    p.outputs.reduce(function (chain, list, i) {
      return chain.then(function () {
        setProgress(i, p.outputs.length, (i + 1) + ' / ' + p.outputs.length + ' 엮는 중…');
        /* 목록을 복사해서 넘긴다 — 엮으며 붙이는 표시가 원래 목록에 남지 않게 */
        return build(list.map(function (x) { return Object.assign({}, x); })).then(function (bytes) {
          var blob = new Blob([bytes], { type: 'application/pdf' });
          if (!zip) { single = blob; return null; }
          return zip.add(name + '_' + String(i + 1).padStart(digits, '0') + '.pdf', blob);
        });
      });
    }, Promise.resolve()).then(function () {
      var secs = ((Date.now() - started) / 1000).toFixed(1);
      if (zip) {
        var zb = zip.finish();
        Zip.download(zb, name + '.zip');
        logLine('ok', 'PDF ' + p.outputs.length + '개를 ' + name + '.zip 으로 받았습니다 (' + fmtBytes(zb.size) + ', ' + secs + '초)');
      } else {
        Zip.download(single, name + '.pdf');
        logLine('ok', name + '.pdf 를 받았습니다 (' + fmtBytes(single.size) + ', ' + secs + '초)');
      }
    }).catch(function (e) {
      logLine('err', '저장하지 못했습니다: ' + ((e && e.message) || e));
      window.alert('저장하지 못했습니다.\n' + ((e && e.message) || e));
    }).then(function () {
      state.busy = false;
      $('progWrap').hidden = true;
      refreshSave();
    });
  });

  /* ── 켜기 ────────────────────────────────────────────────────────── */

  render();
  viewer().then(function () { logLine('ok', '준비됐습니다. 파일은 이 브라우저 안에서만 처리됩니다.'); },
    function (e) { logLine('err', 'PDF 보기 도구를 불러오지 못했습니다: ' + e.message); });

  /* 자체 점검용 손잡이 (화면에는 안 보인다) */
  window.__pages = { state: state, addFiles: addFiles, plan: plan, build: build, parseRanges: parseRanges };
}());
