(function (root) {
  'use strict';
  function plan(files, options) {
    var start = Number(options.start), width = Number(options.width);
    if (!Number.isSafeInteger(start) || start < 0 || start > 999999 || !Number.isInteger(width) || width < 1 || width > 6) {
      throw new Error('시작 번호는 0~999999, 번호 자릿수는 1~6으로 입력하세요.');
    }
    if (!['keep', 'number'].includes(options.mode)) throw new Error('이름 규칙을 선택하세요.');
    if (options.mode === 'number' && !options.base.trim()) throw new Error('새 이름을 입력하세요.');
    var rows = files.map(function (file, i) {
      var dot = file.name.lastIndexOf('.');
      var stem = dot > 0 ? file.name.slice(0, dot) : file.name;
      var ext = dot > 0 ? file.name.slice(dot) : '';
      if (options.find) stem = stem.split(options.find).join(options.replace);
      if (options.mode === 'number') stem = options.base.trim() + '_' + String(start + i).padStart(width, '0');
      var name = (options.prefix + stem + options.suffix).normalize('NFC') + ext;
      var error = '';
      if (!name || !stem || /[<>:"/\\|?*\u0000-\u001f]/.test(name) || /[. ]$/.test(name) || name === '.' || name === '..') error = '사용할 수 없는 이름';
      if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)) error = 'Windows 예약 이름';
      if (name.length > 240) error = '이름이 너무 깁니다 (240자 이하)';
      return { file: file, before: file.name, after: name, error: error };
    });
    var counts = new Map();
    rows.forEach(function (r) { var key = r.after.normalize('NFC').toLowerCase(); counts.set(key, (counts.get(key) || 0) + 1); });
    rows.forEach(function (r) { if (counts.get(r.after.normalize('NFC').toLowerCase()) > 1) r.error = '다른 파일과 이름이 겹칩니다'; });
    return rows;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = plan;
  else root.RenamePlan = plan;
}(typeof window === 'undefined' ? globalThis : window));
