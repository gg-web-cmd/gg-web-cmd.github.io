/* QR · 짧은 주소 (웹판)
 *
 * 설치판(C:\vibe\url-qr\url_qr.py)의 웹판.
 *   · 주소 다듬기: 앞뒤 공백·따옴표를 떼고, https:// 가 없으면 붙인다
 *   · 짧게 만들기: 앞쪽 서비스부터 원하는 개수만큼 **동시에** 요청하고,
 *     실패한 자리에는 곧바로 다음 서비스를 넣어 개수를 채운다 (da.gd → is.gd → v.gd)
 *     세 곳 모두 브라우저에서 직접 부를 수 있다(CORS 허용, 2026-10 확인).
 *   · QR 은 이 브라우저 안에서 만든다 (qrcode-generator, UTF-8)
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var TIMEOUT = 8000;

  function withTimeout(p) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('응답이 없습니다')); }, TIMEOUT); })]);
  }

  function cleanError(text, status) {
    var body = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
    return body || ('HTTP ' + status);
  }

  function isgd(base) {
    return function (url, alias) {
      var q = '?format=json&url=' + encodeURIComponent(url) + (alias ? '&shorturl=' + encodeURIComponent(alias) : '');
      return withTimeout(fetch(base + q)).then(function (r) {
        return r.text().then(function (t) {
          var j;
          try { j = JSON.parse(t); } catch (_) { throw new Error(cleanError(t, r.status)); }
          if (j.shorturl) return j.shorturl;
          throw new Error(j.errormessage || ('HTTP ' + r.status));
        });
      });
    };
  }

  var SERVICES = [
    ['da.gd', function (url, alias) {
      var q = '?url=' + encodeURIComponent(url) + (alias ? '&shorturl=' + encodeURIComponent(alias) : '');
      return withTimeout(fetch('https://da.gd/shorten' + q)).then(function (r) {
        return r.text().then(function (t) {
          t = t.trim();
          if (r.status !== 200 || !/^http/i.test(t) || t.length > 200) throw new Error(cleanError(t, r.status));
          return t.split(/\r?\n/)[0].trim();
        });
      });
    }],
    ['is.gd', isgd('https://is.gd/create.php')],
    ['v.gd', isgd('https://v.gd/create.php')],
  ];

  var state = { orig: '', shorts: [], current: -1 };

  /* ── 주소 다듬기 (설치판 normalize_url 과 같다) ─────────────────── */

  function normalize(raw) {
    var url = String(raw || '').trim().replace(/^["']|["']$/g, '');
    if (!url) throw new Error('주소를 입력해 주세요.');
    if (!/^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(url)) url = url.indexOf('//') === 0 ? 'https:' + url : 'https://' + url;
    var u;
    try { u = new URL(url); } catch (_) { throw new Error('올바른 주소가 아닙니다: ' + raw.trim()); }
    if ((u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.indexOf('.') < 0) {
      throw new Error('올바른 주소가 아닙니다: ' + raw.trim());
    }
    return url;
  }

  /* ── 여러 곳에 동시에 (설치판 shorten_multi 와 같은 방식) ────────── */

  function shortenMulti(url, want, preferred, alias, onEvent) {
    var order = SERVICES.slice();
    if (preferred) {
      var i = order.findIndex(function (s) { return s[0] === preferred; });
      if (i > 0) order.unshift(order.splice(i, 1)[0]);
    }
    var results = [];
    var errors = [];
    var next = 0;
    var inflight = 0;
    return new Promise(function (resolve) {
      function fillSlots() {
        while (next < order.length && inflight + results.length < want) launch(order[next++]);
        if (!inflight) resolve({ results: results.slice(0, want), errors: errors });
      }
      function launch(svc) {
        inflight += 1;
        onEvent('try', svc[0]);
        svc[1](url, alias).then(function (short) {
          inflight -= 1;
          if (results.length < want) { results.push([svc[0], short]); onEvent('ok', svc[0], short); }
          fillSlots();
        }, function (e) {
          inflight -= 1;
          var m = (e && e.message) || '실패';
          /* is.gd·v.gd 는 거절할 때(짧은 시간에 여러 번 요청 등) CORS 머리글 없이 답해서
           * 브라우저에는 이유가 안 보이고 "연결 실패" 로만 보인다 */
          if (/Failed to fetch|NetworkError|Load failed/i.test(m)) m = '거절되었거나 연결할 수 없습니다 (잠시 뒤 다시 해 보세요)';
          errors.push([svc[0], m]);
          onEvent('fail', svc[0], m);
          fillSlots();
        });
      }
      fillSlots();
    });
  }

  /* ── QR ──────────────────────────────────────────────────────────── */

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  function qrData() {
    if ($('content').value === 'short' && state.current >= 0 && state.shorts[state.current]) return state.shorts[state.current][1];
    return state.orig;
  }

  /** border 4칸 · 검정/흰색 · 원하는 크기에 딱 맞게 (설치판 make_qr 과 같은 모양) */
  function drawQr(cv, data, size) {
    var q = qrcode(0, $('level').value);
    q.addData(data, 'Byte');
    q.make();
    var n = q.getModuleCount();
    var border = 4;
    var cells = n + border * 2;
    cv.width = size;
    cv.height = size;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    var k = size / cells;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (q.isDark(r, c)) {
          var x0 = Math.round((c + border) * k);
          var y0 = Math.round((r + border) * k);
          ctx.fillRect(x0, y0, Math.round((c + border + 1) * k) - x0, Math.round((r + border + 1) * k) - y0);
        }
      }
    }
    return n;
  }

  function refreshQr() {
    var data = qrData();
    var has = !!data;
    ['btnPng', 'btnCopyImg', 'btnCopyUrl'].forEach(function (id) { $(id).disabled = !has; });
    if (!has) return;
    try {
      drawQr($('qr'), data, 480);
      $('qrText').textContent = data;
    } catch (e) {
      $('qrText').textContent = 'QR 을 만들 수 없습니다 (주소가 너무 깁니다)';
    }
  }

  function renderList(pending) {
    var ul = $('list');
    var rows = state.shorts.map(function (s, i) {
      return '<li data-i="' + i + '" class="' + (i === state.current ? 'on' : '') + '"><span class="svc">' + esc(s[0])
        + '</span><span class="u">' + esc(s[1]) + '</span><span class="n">' + s[1].length + '자</span></li>';
    });
    (pending || []).forEach(function (p) { rows.push('<li class="fail"><span class="svc">' + esc(p[0]) + '</span><span>' + esc(p[1]) + '</span><span></span></li>'); });
    ul.innerHTML = rows.length ? rows.join('') : '<li class="empty">[짧게 + QR] 을 누르면 여기에 쌓입니다. 줄을 누르면 그 주소로 QR 을 다시 만듭니다.</li>';
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function msg(t, warn) { $('msg').textContent = t; $('msg').classList.toggle('warn', !!warn); }

  /* ── 단추 ────────────────────────────────────────────────────────── */

  function readUrl() {
    try { state.orig = normalize($('url').value); $('url').value = state.orig; return true; }
    catch (e) { msg(e.message, true); return false; }
  }

  $('btnQrOnly').addEventListener('click', function () {
    if (!readUrl()) return;
    $('content').value = 'orig';
    msg('원래 주소로 QR 을 만들었습니다.');
    refreshQr();
  });

  $('btnShort').addEventListener('click', function () {
    if (!readUrl()) return;
    if (!/^https?:/i.test(state.orig)) { msg('http/https 주소만 짧게 만들 수 있습니다. QR 만 만듭니다.', true); $('content').value = 'orig'; refreshQr(); return; }
    var want = Number($('want').value);
    var alias = $('alias').value.trim();
    var fails = [];
    $('btnShort').disabled = true;
    msg('짧은 주소를 만드는 중…');
    var before = state.shorts.length;
    shortenMulti(state.orig, want, $('prefer').value, alias, function (kind, name, value) {
      if (kind === 'ok') {
        state.shorts.unshift([name, value]);
        state.current = 0;
        $('content').value = 'short';
        renderList(fails);
        refreshQr();
      } else if (kind === 'fail') {
        fails.push([name, value]);
        renderList(fails);
      }
    }).then(function (r) {
      $('btnShort').disabled = false;
      var got = state.shorts.length - before;
      if (got) msg(got + '개를 만들었습니다' + (r.errors.length ? ' (' + r.errors.length + '곳 실패)' : '') + '. 줄을 눌러 고르면 QR 이 바뀝니다.');
      else { msg('짧은 주소를 만들지 못했습니다. 잠시 뒤 다시 누르거나 [QR만] 을 쓰세요.', true); $('content').value = 'orig'; refreshQr(); }
    });
  });

  $('url').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('btnShort').click(); });

  $('list').addEventListener('click', function (e) {
    var li = e.target.closest('li[data-i]');
    if (!li) return;
    state.current = Number(li.dataset.i);
    $('content').value = 'short';
    renderList();
    refreshQr();
  });

  ['content', 'level'].forEach(function (id) { $(id).addEventListener('change', refreshQr); });

  function fileName(url) {
    var host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (_) {}
    return 'qr_' + (host.replace(/[^A-Za-z0-9._-]/g, '_') || 'qr') + '.png';
  }

  function sizedBlob() {
    var cv = document.createElement('canvas');
    drawQr(cv, qrData(), Number($('size').value));
    return new Promise(function (res) { cv.toBlob(res, 'image/png'); });
  }

  $('btnPng').addEventListener('click', function () {
    sizedBlob().then(function (b) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = fileName(qrData());
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 30000);
    });
  });

  $('btnCopyImg').addEventListener('click', function () {
    if (!navigator.clipboard || !window.ClipboardItem) { msg('이 브라우저는 이미지 복사를 지원하지 않습니다. [PNG 저장] 을 쓰세요.', true); return; }
    navigator.clipboard.write([new ClipboardItem({ 'image/png': sizedBlob() })]).then(function () {
      msg('QR 이미지를 복사했습니다. 한글·워드·PPT 에 붙여 넣으세요.');
    }, function () { msg('복사하지 못했습니다. [PNG 저장] 을 쓰세요.', true); });
  });

  $('btnCopyUrl').addEventListener('click', function () {
    var t = qrData();
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
      msg('복사했습니다: ' + t);
    }, function () { window.prompt('복사해 가세요', t); });
  });

  /* 주소창 ?u=… 로 열면 입력칸에 미리 채운다 (설치판의 명령줄 인수 자리) */
  try {
    var pre = new URLSearchParams(location.search).get('u');
    if (pre) $('url').value = pre;
  } catch (_) {}

  window.__qr = { normalize: normalize, drawQr: drawQr, state: state };
}());
