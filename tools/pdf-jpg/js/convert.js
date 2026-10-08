/* PDF 를 읽고 쪽을 그려 JPG 로 굽는 곳 — 전부 브라우저 안에서 일어난다.
 *
 * 이렇게 하는 까닭:
 *  · 컴퓨터에 따로 깔 것이 없다 (Edge·Chrome 이 이미 하는 일이다)
 *  · PDF 는 이 컴퓨터 밖으로 나가지 않는다 — 어디로도 올려 보내지 않는다
 *
 * pdf.js 알맹이는 tools/common/pdfjs 에 있다 (PDF 메뉴의 도구들이 함께 쓴다).
 */
(function (root) {
  'use strict';

  var Shared = root.Shared;
  var pdfjs = null;
  var loading = null;

  /* pdf.js 가 곁다리 파일을 찾아갈 자리 — tools/common/pdfjs */
  function at(rel) { return new URL(rel, document.baseURI).href; }
  var PATHS = {
    cMapUrl: at('../common/pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: at('../common/pdfjs/standard_fonts/'),
    wasmUrl: at('../common/pdfjs/wasm/'),
    iccUrl: at('../common/pdfjs/iccs/'),
  };

  /** pdf.js 를 한 번만 불러온다 */
  function ready() {
    if (pdfjs) return Promise.resolve(pdfjs);
    if (loading) return loading;
    loading = import(at('../common/pdfjs/pdf.min.mjs')).then(function (mod) {
      mod.GlobalWorkerOptions.workerSrc = at('../common/pdfjs/pdf.worker.min.mjs');
      pdfjs = mod;
      return mod;
    });
    return loading;
  }

  /** pdf.js 가 던진 오류를 사람 말로 */
  function humanError(e) {
    var name = (e && e.name) || '';
    var msg = (e && e.message) || String(e);
    if (name === 'PasswordException') return '암호가 걸린 PDF 입니다.';
    if (name === 'InvalidPDFException') return 'PDF 파일이 아니거나 내용이 깨졌습니다.';
    if (name === 'MissingPDFException') return '파일을 찾을 수 없습니다.';
    if (/worker/i.test(msg)) return 'PDF 처리기를 띄우지 못했습니다: ' + msg;
    return msg;
  }

  /**
   * PDF 열기.
   *   file = File (고르거나 끌어다 놓은 것)
   *   ask(문구) → 암호 문자열 또는 null
   */
  function open(file, ask) {
    return ready().then(function (mod) {
      return file.arrayBuffer().then(function (buf) {
        var params = Object.assign({}, PATHS, {
          isEvalSupported: false,        // PDF 안의 스크립트는 아예 돌리지 않는다
          useSystemFonts: true,
          data: new Uint8Array(buf),
        });
        return start(mod, params, ask);
      });
    });
  }

  function start(mod, params, ask) {
    var task = mod.getDocument(params);
    if (typeof ask === 'function') {
      task.onPassword = function (updatePassword, reason) {
        var again = reason === mod.PasswordResponses.INCORRECT_PASSWORD;
        var pw = ask(again ? '암호가 맞지 않습니다. 다시 넣어 주세요.' : '이 PDF 에는 암호가 걸려 있습니다.');
        if (pw == null) task.destroy();
        else updatePassword(pw);
      };
    }
    return task.promise.then(function (doc) {
      return doc.getPage(1).then(function (page) {
        var vp = page.getViewport({ scale: 1 });
        page.cleanup();
        return {
          doc: doc,
          pages: doc.numPages,
          ptW: vp.width,
          ptH: vp.height,
        };
      });
    });
  }

  function close(doc) {
    try { if (doc) doc.destroy(); } catch (_) { /* 이미 닫혔으면 그만 */ }
  }

  /* ── 쪽 하나를 그려 JPG 로 ─────────────────────────────────────── */

  var work = null;
  function canvas() {
    if (!work) work = document.getElementById('work') || document.createElement('canvas');
    return work;
  }

  function toBlob(cv, quality) {
    return new Promise(function (resolve, reject) {
      cv.toBlob(function (blob) {
        if (blob && blob.size) resolve(blob);
        else reject(new Error('사진으로 굽지 못했습니다 (그림이 너무 큰 것 같습니다)'));
      }, 'image/jpeg', quality);
    });
  }

  /**
   * 한 쪽을 그려서 JPG 덩어리로 돌려준다.
   *   opt = {size:{mode,dpi,px}, quality:'high'}
   *
   * 쪽마다 회전(/Rotate)이 걸려 있으면 pdf.js 가 알아서 세워 준다 — 우리가 손대지 않는다.
   * JPG 는 투명을 담지 못하므로 바탕은 흰색으로 깐다(pdf.js 기본값도 흰색이다).
   */
  function renderPage(doc, pageNo, opt) {
    var o = opt || {};
    return doc.getPage(pageNo).then(function (page) {
      var base = page.getViewport({ scale: 1 });
      var plan = Shared.renderSize(base.width, base.height, o.size);
      var vp = page.getViewport({ scale: plan.scale });

      var cv = canvas();
      cv.width = Math.max(1, Math.floor(vp.width));
      cv.height = Math.max(1, Math.floor(vp.height));
      var ctx = cv.getContext('2d', { alpha: false, willReadFrequently: false });
      if (!ctx) throw new Error('그림판을 만들 수 없습니다');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);

      var task = page.render({
        canvasContext: ctx,
        viewport: vp,
        background: '#ffffff',
        annotationMode: pdfjs.AnnotationMode.ENABLE,
        intent: 'print',           // 인쇄했을 때와 같은 모습으로
      });

      return task.promise.then(function () {
        return toBlob(cv, Shared.qualityOf(o.quality));
      }).then(function (blob) {
        page.cleanup();
        return {
          blob: blob,
          width: cv.width,
          height: cv.height,
          dpi: plan.dpi,
          limited: plan.limited,
        };
      }).catch(function (e) {
        try { page.cleanup(); } catch (_) {}
        throw e;
      });
    });
  }

  /** 다 쓴 그림판이 메모리를 붙들고 있지 않게 */
  function release() {
    if (!work) return;
    work.width = 1;
    work.height = 1;
  }

  root.Convert = {
    ready: ready,
    open: open,
    close: close,
    renderPage: renderPage,
    release: release,
    humanError: humanError,
  };
}(window));
