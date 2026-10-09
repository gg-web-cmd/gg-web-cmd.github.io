(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var files = [], rows = [], busy = false;
  function refresh() {
    $('status').textContent = '';
    var ordered = files.slice();
    if ($('order').value === 'name') ordered.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko', { numeric: true }); });
    var options = {};
    ['mode', 'base', 'start', 'width', 'prefix', 'suffix', 'find', 'replace'].forEach(function (id) { options[id] = $(id).value; });
    $('base').disabled = $('start').disabled = $('width').disabled = options.mode !== 'number';
    $('find').disabled = $('replace').disabled = options.mode !== 'keep';
    rows = [];
    var message = '';
    try { rows = RenamePlan(ordered, options); } catch (e) { message = e.message; }
    $('rows').replaceChildren();
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      [row.before, row.after, row.error || (row.before === row.after ? '변경 없음' : '변경')].forEach(function (value) {
        var td = document.createElement('td'); td.textContent = value; tr.appendChild(td);
      });
      if (row.error) tr.className = 'bad';
      $('rows').appendChild(tr);
    });
    var errors = rows.filter(function (r) { return !!r.error; }).length;
    $('summary').textContent = message || (files.length ? files.length + '개 파일 · ' + (files.reduce(function (n, f) { return n + f.size; }, 0) / 1048576).toFixed(1) + 'MB · 문제 ' + errors + '개' : '파일을 선택하세요.');
    $('save').disabled = busy || !rows.length || !!message || !!errors;
  }
  function select(list) {
    if (busy) return;
    var next = Array.from(list);
    if (next.length > 500 || next.reduce(function (n, f) { return n + f.size; }, 0) > 250 * 1048576) {
      $('status').textContent = '500개 · 합계 250MB 이하로 나누어 선택하세요. 기존 목록은 유지됩니다.';
      $('files').value = ''; return;
    }
    files = next; refresh();
  }
  $('files').addEventListener('change', function () { select(this.files); });
  ['mode', 'order', 'base', 'start', 'width', 'prefix', 'suffix', 'find', 'replace'].forEach(function (id) { $(id).addEventListener('input', refresh); });
  $('drop').addEventListener('dragover', function (e) { e.preventDefault(); if (!busy) this.classList.add('drag'); });
  $('drop').addEventListener('dragleave', function () { this.classList.remove('drag'); });
  $('drop').addEventListener('drop', function (e) {
    e.preventDefault(); this.classList.remove('drag');
    var hasFolder = Array.from(e.dataTransfer.items || []).some(function (item) { var entry = item.webkitGetAsEntry && item.webkitGetAsEntry(); return entry && entry.isDirectory; });
    if (hasFolder) { $('status').textContent = '폴더 안의 파일을 선택해서 넣어 주세요. 폴더는 처리하지 않습니다.'; return; }
    select(e.dataTransfer.files);
  });
  // Prevent navigation when a file misses the drop target.
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); });
  $('clear').addEventListener('click', function () { files = []; $('files').value = ''; refresh(); });
  $('sample').addEventListener('click', function () {
    $('files').value = '';
    $('mode').value = 'number'; $('base').value = '과제'; $('prefix').value = $('suffix').value = ''; $('start').value = '1'; $('width').value = '3';
    select([new File(['예시 첫 번째 파일입니다.'], '과제 - 복사본.txt'), new File(['예시 두 번째 파일입니다.'], '과제 최종.txt')]);
    $('status').textContent = '체험용 텍스트 파일입니다. ZIP을 저장해 결과를 확인할 수 있습니다.';
  });
  $('save').addEventListener('click', async function () {
    if (busy || this.disabled) return;
    var snapshot = rows.slice(); busy = true; $('controls').disabled = true; this.disabled = true;
    try {
      var zip = Zip();
      for (var i = 0; i < snapshot.length; i++) {
        $('status').textContent = (i + 1) + ' / ' + snapshot.length + '개 담는 중…';
        await zip.add(snapshot[i].after, snapshot[i].file);
        await new Promise(function (resolve) { setTimeout(resolve, 0); });
      }
      Zip.download(zip.finish(), '이름바꾼파일.zip');
      $('status').textContent = snapshot.length + '개 파일의 ZIP 다운로드를 요청했습니다. 브라우저 다운로드 목록을 확인하세요.';
    } catch (e) { $('status').textContent = '저장하지 못했습니다: ' + e.message + ' 파일 수나 크기를 줄여 다시 시도하세요.'; }
    finally { busy = false; $('controls').disabled = false; $('save').disabled = false; }
  });
  refresh();
}());
