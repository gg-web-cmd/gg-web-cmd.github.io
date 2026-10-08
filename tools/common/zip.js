/* 아주 작은 ZIP 만들기 — 압축하지 않고 담기만 한다(STORE).
 *
 * JPG·PNG·영상은 이미 눌러 담긴 파일이라 다시 압축해 봐야 거의 줄지 않는다.
 * 그래서 라이브러리 없이 이 정도로 충분하다. 한글 파일 이름은 UTF-8 표시(비트 11)를 켜서
 * 윈도우 탐색기·반디집·알집 어디서 풀어도 깨지지 않게 한다.
 *
 *   var z = Zip();
 *   await z.add('폴더/이름_001.jpg', blob);
 *   var blob = z.finish();      // application/zip
 */
(function (root) {
  'use strict';

  var TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  }());

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  function Zip() {
    var parts = [];       // 로컬 머리 + 내용
    var central = [];     // 가운데 목록
    var offset = 0;
    var count = 0;
    var names = {};
    var enc = new TextEncoder();
    var stamp = dosTime(new Date());

    /** 같은 이름이 또 들어오면 "이름 (2).jpg" 로 비켜 준다 */
    function unique(name) {
      if (!names[name]) { names[name] = 1; return name; }
      var dot = name.lastIndexOf('.');
      var stem = dot > name.lastIndexOf('/') ? name.slice(0, dot) : name;
      var ext = dot > name.lastIndexOf('/') ? name.slice(dot) : '';
      for (var i = 2; ; i++) {
        var n = stem + ' (' + i + ')' + ext;
        if (!names[n]) { names[n] = 1; return n; }
      }
    }

    function add(name, blob) {
      return blob.arrayBuffer().then(function (buf) {
        var data = new Uint8Array(buf);
        var path = unique(String(name).replace(/\\/g, '/'));
        var nameBytes = enc.encode(path);
        var crc = crc32(data);
        var size = data.length;
        if (size >= 0xFFFFFFFF || offset >= 0xFFFFFFFF) throw new Error('ZIP 하나에 4GB 넘게는 담을 수 없습니다. 나눠서 받아 주세요.');

        var local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true);        // UTF-8 이름
        local.setUint16(8, 0, true);             // 압축 안 함
        local.setUint16(10, stamp.time, true);
        local.setUint16(12, stamp.date, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, size, true);
        local.setUint32(22, size, true);
        local.setUint16(26, nameBytes.length, true);
        local.setUint16(28, 0, true);

        var cen = new DataView(new ArrayBuffer(46));
        cen.setUint32(0, 0x02014b50, true);
        cen.setUint16(4, 20, true);
        cen.setUint16(6, 20, true);
        cen.setUint16(8, 0x0800, true);
        cen.setUint16(10, 0, true);
        cen.setUint16(12, stamp.time, true);
        cen.setUint16(14, stamp.date, true);
        cen.setUint32(16, crc, true);
        cen.setUint32(20, size, true);
        cen.setUint32(24, size, true);
        cen.setUint16(28, nameBytes.length, true);
        cen.setUint32(42, offset, true);

        parts.push(local.buffer, nameBytes, data);
        central.push(cen.buffer, nameBytes);
        offset += 30 + nameBytes.length + size;
        count += 1;
        return path;
      });
    }

    function finish() {
      var cenSize = central.reduce(function (n, p) { return n + p.byteLength; }, 0);
      var end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, count, true);
      end.setUint16(10, count, true);
      end.setUint32(12, cenSize, true);
      end.setUint32(16, offset, true);
      return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
    }

    return { add: add, finish: finish, get count() { return count; } };
  }

  /** 덩어리 하나를 파일로 내려받게 한다 */
  function download(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  root.Zip = Zip;
  root.Zip.download = download;
  root.Zip.crc32 = crc32;
}(window));
