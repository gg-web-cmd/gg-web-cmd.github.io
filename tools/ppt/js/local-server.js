/* PPT 리스타일러 (웹판) — 설치판의 Node 서버(server.js) 자리를 브라우저 안에서 대신한다.
 *
 * 화면(app.js)은 원본 그대로 fetch('/api/…') 를 부른다. 여기서 그 길목을 가로채
 * 서버와 같은 대답(JSON · PPTX 덩어리 · X-Restyle-Report 머리글)을 돌려준다.
 * 변환은 원본 lib/restyle.js 를 그대로 묶은 nodelibs.js 가 하고,
 * 디자인 목록은 DESIGN-*.md 를 빌드할 때 굳혀 둔 designs.json 에서 읽는다.
 * PPTX 는 이 브라우저 밖으로 나가지 않는다.
 */
(function (root) {
  'use strict';

  var L = root.NodeLibs;
  var realFetch = root.fetch.bind(root);
  var PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  var designs = null;
  var sample = null;

  function loadDesigns() {
    if (!designs) {
      designs = realFetch(new URL('designs.json', document.baseURI).href).then(function (r) { return r.json(); });
    }
    return designs;
  }

  function json(obj, status) {
    return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
  }

  function boolOpt(params, key, dflt) {
    var v = params.get(key);
    if (v === null || v === '') return dflt;
    return v === '1' || v === 'true' || v === 'on';
  }

  /* 설치판 server.js 의 optionsFromQuery 와 같다 */
  function optionsFromQuery(params) {
    var upper = params.get('uppercaseTitles');
    return {
      recolorText: boolOpt(params, 'recolorText', true),
      recolorFills: boolOpt(params, 'recolorFills', true),
      forceBackground: boolOpt(params, 'forceBackground', true),
      keepBackgroundImages: boolOpt(params, 'keepBackgroundImages', true),
      changeFonts: boolOpt(params, 'changeFonts', true),
      brandFontFirst: boolOpt(params, 'brandFontFirst', false),
      koreanFont: params.get('koreanFont') || '',
      uppercaseTitles: upper === null || upper === '' || upper === 'auto' ? null : boolOpt(params, 'uppercaseTitles', false),
      signature: boolOpt(params, 'signature', true),
    };
  }

  function toB64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function bodyBytes(body) {
    if (!body) return Promise.resolve(new Uint8Array(0));
    if (body instanceof Blob) return body.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    if (body instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(body));
    return Promise.resolve(new Uint8Array(body));
  }

  function handle(method, url, init) {
    var p = url.pathname.replace(/^.*\/api\//, '/api/');
    if (method === 'GET' && p === '/api/designs') {
      return loadDesigns().then(function (d) { return json({ designs: d.summaries }); });
    }
    if (method === 'GET' && p.indexOf('/api/designs/') === 0) {
      var slug = decodeURIComponent(p.slice('/api/designs/'.length));
      return loadDesigns().then(function (d) {
        var one = d.full.find(function (x) { return x.slug === slug; });
        return one ? json(one) : json({ error: '해당 디자인을 찾을 수 없습니다.' }, 404);
      });
    }
    if (method === 'POST' && p === '/api/reload') {
      return loadDesigns().then(function (d) { return json({ designs: d.summaries }); });
    }
    if (method === 'GET' && p === '/api/sample') {
      sample = sample || L.sample.buildSamplePptx(null);
      return sample.then(function (buf) { return new Response(new Blob([buf], { type: PPTX })); });
    }
    if (method === 'POST' && p === '/api/analyze') {
      return bodyBytes(init && init.body).then(function (buf) {
        var JSZip = L.jszip.default || L.jszip;
        return JSZip.loadAsync(buf).catch(function () { return null; });
      }).then(function (zip) {
        if (!zip || !zip.file('[Content_Types].xml')) {
          return json({ error: 'PPTX 파일을 열 수 없습니다. .pptx 형식인지 확인해 주세요.' }, 400);
        }
        return L.restyle.extractDeckOutline(zip).then(function (outline) {
          if (!outline.length) return json({ error: '슬라이드를 찾지 못했습니다.' }, 400);
          return json({ slideCount: outline.length, outline: outline });
        });
      });
    }
    if (method === 'POST' && p === '/api/convert') {
      var params = url.searchParams;
      return loadDesigns().then(function (d) {
        var design = d.full.find(function (x) { return x.slug === params.get('design'); });
        if (!design) return json({ error: '디자인을 먼저 선택해 주세요.' }, 400);
        return bodyBytes(init && init.body).then(function (buf) {
          if (!buf.length) return json({ error: '업로드된 파일이 비어 있습니다.' }, 400);
          var started = performance.now();
          return L.restyle.restylePptx(buf, design, optionsFromQuery(params)).then(function (r) {
            var report = Object.assign({}, r.report, { ms: Math.round(performance.now() - started), design: design.label });
            return new Response(new Blob([r.buffer], { type: PPTX }), {
              headers: { 'Content-Type': PPTX, 'X-Restyle-Report': toB64(JSON.stringify(report)) },
            });
          });
        });
      }).catch(function (e) { return json({ error: (e && e.message) || '변환 중 오류' }, 500); });
    }
    return Promise.resolve(json({ error: 'unknown endpoint' }, 404));
  }

  root.fetch = function (input, init) {
    var href = typeof input === 'string' ? input : (input && input.url) || '';
    var url = new URL(href, location.href);
    if (url.origin !== location.origin || url.pathname.indexOf('/api/') !== 0) return realFetch(input, init);
    return handle(((init && init.method) || 'GET').toUpperCase(), url, init);
  };
}(window));
