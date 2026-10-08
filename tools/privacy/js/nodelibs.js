/* 자동 생성 파일 — 고치지 마세요. _build/build.js 가 설치판 lib 를 묶어 만듭니다. */
var NodeLibs = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:process.argv>
  var init_define_process_argv = __esm({
    "<define:process.argv>"() {
    }
  });

  // <define:process.env>
  var define_process_env_default;
  var init_define_process_env = __esm({
    "<define:process.env>"() {
      define_process_env_default = {};
    }
  });

  // node_modules/base64-js/index.js
  var require_base64_js = __commonJS({
    "node_modules/base64-js/index.js"(exports) {
      "use strict";
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      exports.byteLength = byteLength;
      exports.toByteArray = toByteArray;
      exports.fromByteArray = fromByteArray;
      var lookup = [];
      var revLookup = [];
      var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
      var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (i = 0, len = code.length; i < len; ++i) {
        lookup[i] = code[i];
        revLookup[code.charCodeAt(i)] = i;
      }
      var i;
      var len;
      revLookup["-".charCodeAt(0)] = 62;
      revLookup["_".charCodeAt(0)] = 63;
      function getLens(b64) {
        var len2 = b64.length;
        if (len2 % 4 > 0) {
          throw new Error("Invalid string. Length must be a multiple of 4");
        }
        var validLen = b64.indexOf("=");
        if (validLen === -1) validLen = len2;
        var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
        return [validLen, placeHoldersLen];
      }
      function byteLength(b64) {
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function _byteLength(b64, validLen, placeHoldersLen) {
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function toByteArray(b64) {
        var tmp;
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
        var curByte = 0;
        var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
        var i2;
        for (i2 = 0; i2 < len2; i2 += 4) {
          tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
          arr[curByte++] = tmp >> 16 & 255;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 2) {
          tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 1) {
          tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        return arr;
      }
      function tripletToBase64(num) {
        return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
      }
      function encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i2 = start; i2 < end; i2 += 3) {
          tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
          output.push(tripletToBase64(tmp));
        }
        return output.join("");
      }
      function fromByteArray(uint8) {
        var tmp;
        var len2 = uint8.length;
        var extraBytes = len2 % 3;
        var parts = [];
        var maxChunkLength = 16383;
        for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
          parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
        }
        if (extraBytes === 1) {
          tmp = uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
          );
        } else if (extraBytes === 2) {
          tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
          );
        }
        return parts.join("");
      }
    }
  });

  // node_modules/ieee754/index.js
  var require_ieee754 = __commonJS({
    "node_modules/ieee754/index.js"(exports) {
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      exports.read = function(buffer, offset, isLE, mLen, nBytes) {
        var e, m;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var nBits = -7;
        var i = isLE ? nBytes - 1 : 0;
        var d = isLE ? -1 : 1;
        var s = buffer[offset + i];
        i += d;
        e = s & (1 << -nBits) - 1;
        s >>= -nBits;
        nBits += eLen;
        for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        m = e & (1 << -nBits) - 1;
        e >>= -nBits;
        nBits += mLen;
        for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
        }
        if (e === 0) {
          e = 1 - eBias;
        } else if (e === eMax) {
          return m ? NaN : (s ? -1 : 1) * Infinity;
        } else {
          m = m + Math.pow(2, mLen);
          e = e - eBias;
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
      };
      exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
        var e, m, c;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
        var i = isLE ? 0 : nBytes - 1;
        var d = isLE ? 1 : -1;
        var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
        value = Math.abs(value);
        if (isNaN(value) || value === Infinity) {
          m = isNaN(value) ? 1 : 0;
          e = eMax;
        } else {
          e = Math.floor(Math.log(value) / Math.LN2);
          if (value * (c = Math.pow(2, -e)) < 1) {
            e--;
            c *= 2;
          }
          if (e + eBias >= 1) {
            value += rt / c;
          } else {
            value += rt * Math.pow(2, 1 - eBias);
          }
          if (value * c >= 2) {
            e++;
            c /= 2;
          }
          if (e + eBias >= eMax) {
            m = 0;
            e = eMax;
          } else if (e + eBias >= 1) {
            m = (value * c - 1) * Math.pow(2, mLen);
            e = e + eBias;
          } else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
            e = 0;
          }
        }
        for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
        }
        e = e << mLen | m;
        eLen += mLen;
        for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
        }
        buffer[offset + i - d] |= s * 128;
      };
    }
  });

  // node_modules/buffer/index.js
  var require_buffer = __commonJS({
    "node_modules/buffer/index.js"(exports) {
      "use strict";
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      var base64 = require_base64_js();
      var ieee754 = require_ieee754();
      var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
      exports.Buffer = Buffer6;
      exports.SlowBuffer = SlowBuffer;
      exports.INSPECT_MAX_BYTES = 50;
      var K_MAX_LENGTH = 2147483647;
      exports.kMaxLength = K_MAX_LENGTH;
      Buffer6.TYPED_ARRAY_SUPPORT = typedArraySupport();
      if (!Buffer6.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
        console.error(
          "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
        );
      }
      function typedArraySupport() {
        try {
          const arr = new Uint8Array(1);
          const proto = { foo: function() {
            return 42;
          } };
          Object.setPrototypeOf(proto, Uint8Array.prototype);
          Object.setPrototypeOf(arr, proto);
          return arr.foo() === 42;
        } catch (e) {
          return false;
        }
      }
      Object.defineProperty(Buffer6.prototype, "parent", {
        enumerable: true,
        get: function() {
          if (!Buffer6.isBuffer(this)) return void 0;
          return this.buffer;
        }
      });
      Object.defineProperty(Buffer6.prototype, "offset", {
        enumerable: true,
        get: function() {
          if (!Buffer6.isBuffer(this)) return void 0;
          return this.byteOffset;
        }
      });
      function createBuffer(length) {
        if (length > K_MAX_LENGTH) {
          throw new RangeError('The value "' + length + '" is invalid for option "size"');
        }
        const buf = new Uint8Array(length);
        Object.setPrototypeOf(buf, Buffer6.prototype);
        return buf;
      }
      function Buffer6(arg, encodingOrOffset, length) {
        if (typeof arg === "number") {
          if (typeof encodingOrOffset === "string") {
            throw new TypeError(
              'The "string" argument must be of type string. Received type number'
            );
          }
          return allocUnsafe(arg);
        }
        return from(arg, encodingOrOffset, length);
      }
      Buffer6.poolSize = 8192;
      function from(value, encodingOrOffset, length) {
        if (typeof value === "string") {
          return fromString(value, encodingOrOffset);
        }
        if (ArrayBuffer.isView(value)) {
          return fromArrayView(value);
        }
        if (value == null) {
          throw new TypeError(
            "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
          );
        }
        if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof value === "number") {
          throw new TypeError(
            'The "value" argument must not be of type number. Received type number'
          );
        }
        const valueOf = value.valueOf && value.valueOf();
        if (valueOf != null && valueOf !== value) {
          return Buffer6.from(valueOf, encodingOrOffset, length);
        }
        const b = fromObject(value);
        if (b) return b;
        if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
          return Buffer6.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
        }
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      Buffer6.from = function(value, encodingOrOffset, length) {
        return from(value, encodingOrOffset, length);
      };
      Object.setPrototypeOf(Buffer6.prototype, Uint8Array.prototype);
      Object.setPrototypeOf(Buffer6, Uint8Array);
      function assertSize(size) {
        if (typeof size !== "number") {
          throw new TypeError('"size" argument must be of type number');
        } else if (size < 0) {
          throw new RangeError('The value "' + size + '" is invalid for option "size"');
        }
      }
      function alloc(size, fill, encoding) {
        assertSize(size);
        if (size <= 0) {
          return createBuffer(size);
        }
        if (fill !== void 0) {
          return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
        }
        return createBuffer(size);
      }
      Buffer6.alloc = function(size, fill, encoding) {
        return alloc(size, fill, encoding);
      };
      function allocUnsafe(size) {
        assertSize(size);
        return createBuffer(size < 0 ? 0 : checked(size) | 0);
      }
      Buffer6.allocUnsafe = function(size) {
        return allocUnsafe(size);
      };
      Buffer6.allocUnsafeSlow = function(size) {
        return allocUnsafe(size);
      };
      function fromString(string, encoding) {
        if (typeof encoding !== "string" || encoding === "") {
          encoding = "utf8";
        }
        if (!Buffer6.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        const length = byteLength(string, encoding) | 0;
        let buf = createBuffer(length);
        const actual = buf.write(string, encoding);
        if (actual !== length) {
          buf = buf.slice(0, actual);
        }
        return buf;
      }
      function fromArrayLike(array) {
        const length = array.length < 0 ? 0 : checked(array.length) | 0;
        const buf = createBuffer(length);
        for (let i = 0; i < length; i += 1) {
          buf[i] = array[i] & 255;
        }
        return buf;
      }
      function fromArrayView(arrayView) {
        if (isInstance(arrayView, Uint8Array)) {
          const copy = new Uint8Array(arrayView);
          return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
        }
        return fromArrayLike(arrayView);
      }
      function fromArrayBuffer(array, byteOffset, length) {
        if (byteOffset < 0 || array.byteLength < byteOffset) {
          throw new RangeError('"offset" is outside of buffer bounds');
        }
        if (array.byteLength < byteOffset + (length || 0)) {
          throw new RangeError('"length" is outside of buffer bounds');
        }
        let buf;
        if (byteOffset === void 0 && length === void 0) {
          buf = new Uint8Array(array);
        } else if (length === void 0) {
          buf = new Uint8Array(array, byteOffset);
        } else {
          buf = new Uint8Array(array, byteOffset, length);
        }
        Object.setPrototypeOf(buf, Buffer6.prototype);
        return buf;
      }
      function fromObject(obj) {
        if (Buffer6.isBuffer(obj)) {
          const len = checked(obj.length) | 0;
          const buf = createBuffer(len);
          if (buf.length === 0) {
            return buf;
          }
          obj.copy(buf, 0, 0, len);
          return buf;
        }
        if (obj.length !== void 0) {
          if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
            return createBuffer(0);
          }
          return fromArrayLike(obj);
        }
        if (obj.type === "Buffer" && Array.isArray(obj.data)) {
          return fromArrayLike(obj.data);
        }
      }
      function checked(length) {
        if (length >= K_MAX_LENGTH) {
          throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
        }
        return length | 0;
      }
      function SlowBuffer(length) {
        if (+length != length) {
          length = 0;
        }
        return Buffer6.alloc(+length);
      }
      Buffer6.isBuffer = function isBuffer(b) {
        return b != null && b._isBuffer === true && b !== Buffer6.prototype;
      };
      Buffer6.compare = function compare(a, b) {
        if (isInstance(a, Uint8Array)) a = Buffer6.from(a, a.offset, a.byteLength);
        if (isInstance(b, Uint8Array)) b = Buffer6.from(b, b.offset, b.byteLength);
        if (!Buffer6.isBuffer(a) || !Buffer6.isBuffer(b)) {
          throw new TypeError(
            'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
          );
        }
        if (a === b) return 0;
        let x = a.length;
        let y = b.length;
        for (let i = 0, len = Math.min(x, y); i < len; ++i) {
          if (a[i] !== b[i]) {
            x = a[i];
            y = b[i];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      Buffer6.isEncoding = function isEncoding(encoding) {
        switch (String(encoding).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      };
      Buffer6.concat = function concat(list, length) {
        if (!Array.isArray(list)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        }
        if (list.length === 0) {
          return Buffer6.alloc(0);
        }
        let i;
        if (length === void 0) {
          length = 0;
          for (i = 0; i < list.length; ++i) {
            length += list[i].length;
          }
        }
        const buffer = Buffer6.allocUnsafe(length);
        let pos = 0;
        for (i = 0; i < list.length; ++i) {
          let buf = list[i];
          if (isInstance(buf, Uint8Array)) {
            if (pos + buf.length > buffer.length) {
              if (!Buffer6.isBuffer(buf)) buf = Buffer6.from(buf);
              buf.copy(buffer, pos);
            } else {
              Uint8Array.prototype.set.call(
                buffer,
                buf,
                pos
              );
            }
          } else if (!Buffer6.isBuffer(buf)) {
            throw new TypeError('"list" argument must be an Array of Buffers');
          } else {
            buf.copy(buffer, pos);
          }
          pos += buf.length;
        }
        return buffer;
      };
      function byteLength(string, encoding) {
        if (Buffer6.isBuffer(string)) {
          return string.length;
        }
        if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
          return string.byteLength;
        }
        if (typeof string !== "string") {
          throw new TypeError(
            'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
          );
        }
        const len = string.length;
        const mustMatch = arguments.length > 2 && arguments[2] === true;
        if (!mustMatch && len === 0) return 0;
        let loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "ascii":
            case "latin1":
            case "binary":
              return len;
            case "utf8":
            case "utf-8":
              return utf8ToBytes(string).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return len * 2;
            case "hex":
              return len >>> 1;
            case "base64":
              return base64ToBytes(string).length;
            default:
              if (loweredCase) {
                return mustMatch ? -1 : utf8ToBytes(string).length;
              }
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer6.byteLength = byteLength;
      function slowToString(encoding, start, end) {
        let loweredCase = false;
        if (start === void 0 || start < 0) {
          start = 0;
        }
        if (start > this.length) {
          return "";
        }
        if (end === void 0 || end > this.length) {
          end = this.length;
        }
        if (end <= 0) {
          return "";
        }
        end >>>= 0;
        start >>>= 0;
        if (end <= start) {
          return "";
        }
        if (!encoding) encoding = "utf8";
        while (true) {
          switch (encoding) {
            case "hex":
              return hexSlice(this, start, end);
            case "utf8":
            case "utf-8":
              return utf8Slice(this, start, end);
            case "ascii":
              return asciiSlice(this, start, end);
            case "latin1":
            case "binary":
              return latin1Slice(this, start, end);
            case "base64":
              return base64Slice(this, start, end);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return utf16leSlice(this, start, end);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = (encoding + "").toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer6.prototype._isBuffer = true;
      function swap(b, n, m) {
        const i = b[n];
        b[n] = b[m];
        b[m] = i;
      }
      Buffer6.prototype.swap16 = function swap16() {
        const len = this.length;
        if (len % 2 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 16-bits");
        }
        for (let i = 0; i < len; i += 2) {
          swap(this, i, i + 1);
        }
        return this;
      };
      Buffer6.prototype.swap32 = function swap32() {
        const len = this.length;
        if (len % 4 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 32-bits");
        }
        for (let i = 0; i < len; i += 4) {
          swap(this, i, i + 3);
          swap(this, i + 1, i + 2);
        }
        return this;
      };
      Buffer6.prototype.swap64 = function swap64() {
        const len = this.length;
        if (len % 8 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 64-bits");
        }
        for (let i = 0; i < len; i += 8) {
          swap(this, i, i + 7);
          swap(this, i + 1, i + 6);
          swap(this, i + 2, i + 5);
          swap(this, i + 3, i + 4);
        }
        return this;
      };
      Buffer6.prototype.toString = function toString() {
        const length = this.length;
        if (length === 0) return "";
        if (arguments.length === 0) return utf8Slice(this, 0, length);
        return slowToString.apply(this, arguments);
      };
      Buffer6.prototype.toLocaleString = Buffer6.prototype.toString;
      Buffer6.prototype.equals = function equals(b) {
        if (!Buffer6.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
        if (this === b) return true;
        return Buffer6.compare(this, b) === 0;
      };
      Buffer6.prototype.inspect = function inspect() {
        let str = "";
        const max2 = exports.INSPECT_MAX_BYTES;
        str = this.toString("hex", 0, max2).replace(/(.{2})/g, "$1 ").trim();
        if (this.length > max2) str += " ... ";
        return "<Buffer " + str + ">";
      };
      if (customInspectSymbol) {
        Buffer6.prototype[customInspectSymbol] = Buffer6.prototype.inspect;
      }
      Buffer6.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
        if (isInstance(target, Uint8Array)) {
          target = Buffer6.from(target, target.offset, target.byteLength);
        }
        if (!Buffer6.isBuffer(target)) {
          throw new TypeError(
            'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
          );
        }
        if (start === void 0) {
          start = 0;
        }
        if (end === void 0) {
          end = target ? target.length : 0;
        }
        if (thisStart === void 0) {
          thisStart = 0;
        }
        if (thisEnd === void 0) {
          thisEnd = this.length;
        }
        if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
          throw new RangeError("out of range index");
        }
        if (thisStart >= thisEnd && start >= end) {
          return 0;
        }
        if (thisStart >= thisEnd) {
          return -1;
        }
        if (start >= end) {
          return 1;
        }
        start >>>= 0;
        end >>>= 0;
        thisStart >>>= 0;
        thisEnd >>>= 0;
        if (this === target) return 0;
        let x = thisEnd - thisStart;
        let y = end - start;
        const len = Math.min(x, y);
        const thisCopy = this.slice(thisStart, thisEnd);
        const targetCopy = target.slice(start, end);
        for (let i = 0; i < len; ++i) {
          if (thisCopy[i] !== targetCopy[i]) {
            x = thisCopy[i];
            y = targetCopy[i];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
        if (buffer.length === 0) return -1;
        if (typeof byteOffset === "string") {
          encoding = byteOffset;
          byteOffset = 0;
        } else if (byteOffset > 2147483647) {
          byteOffset = 2147483647;
        } else if (byteOffset < -2147483648) {
          byteOffset = -2147483648;
        }
        byteOffset = +byteOffset;
        if (numberIsNaN(byteOffset)) {
          byteOffset = dir ? 0 : buffer.length - 1;
        }
        if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
        if (byteOffset >= buffer.length) {
          if (dir) return -1;
          else byteOffset = buffer.length - 1;
        } else if (byteOffset < 0) {
          if (dir) byteOffset = 0;
          else return -1;
        }
        if (typeof val === "string") {
          val = Buffer6.from(val, encoding);
        }
        if (Buffer6.isBuffer(val)) {
          if (val.length === 0) {
            return -1;
          }
          return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
        } else if (typeof val === "number") {
          val = val & 255;
          if (typeof Uint8Array.prototype.indexOf === "function") {
            if (dir) {
              return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
            } else {
              return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
            }
          }
          return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
        }
        throw new TypeError("val must be string, number or Buffer");
      }
      function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
        let indexSize = 1;
        let arrLength = arr.length;
        let valLength = val.length;
        if (encoding !== void 0) {
          encoding = String(encoding).toLowerCase();
          if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
            if (arr.length < 2 || val.length < 2) {
              return -1;
            }
            indexSize = 2;
            arrLength /= 2;
            valLength /= 2;
            byteOffset /= 2;
          }
        }
        function read(buf, i2) {
          if (indexSize === 1) {
            return buf[i2];
          } else {
            return buf.readUInt16BE(i2 * indexSize);
          }
        }
        let i;
        if (dir) {
          let foundIndex = -1;
          for (i = byteOffset; i < arrLength; i++) {
            if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
              if (foundIndex === -1) foundIndex = i;
              if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
            } else {
              if (foundIndex !== -1) i -= i - foundIndex;
              foundIndex = -1;
            }
          }
        } else {
          if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
          for (i = byteOffset; i >= 0; i--) {
            let found = true;
            for (let j = 0; j < valLength; j++) {
              if (read(arr, i + j) !== read(val, j)) {
                found = false;
                break;
              }
            }
            if (found) return i;
          }
        }
        return -1;
      }
      Buffer6.prototype.includes = function includes(val, byteOffset, encoding) {
        return this.indexOf(val, byteOffset, encoding) !== -1;
      };
      Buffer6.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
      };
      Buffer6.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
      };
      function hexWrite(buf, string, offset, length) {
        offset = Number(offset) || 0;
        const remaining = buf.length - offset;
        if (!length) {
          length = remaining;
        } else {
          length = Number(length);
          if (length > remaining) {
            length = remaining;
          }
        }
        const strLen = string.length;
        if (length > strLen / 2) {
          length = strLen / 2;
        }
        let i;
        for (i = 0; i < length; ++i) {
          const parsed = parseInt(string.substr(i * 2, 2), 16);
          if (numberIsNaN(parsed)) return i;
          buf[offset + i] = parsed;
        }
        return i;
      }
      function utf8Write(buf, string, offset, length) {
        return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
      }
      function asciiWrite(buf, string, offset, length) {
        return blitBuffer(asciiToBytes(string), buf, offset, length);
      }
      function base64Write(buf, string, offset, length) {
        return blitBuffer(base64ToBytes(string), buf, offset, length);
      }
      function ucs2Write(buf, string, offset, length) {
        return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
      }
      Buffer6.prototype.write = function write(string, offset, length, encoding) {
        if (offset === void 0) {
          encoding = "utf8";
          length = this.length;
          offset = 0;
        } else if (length === void 0 && typeof offset === "string") {
          encoding = offset;
          length = this.length;
          offset = 0;
        } else if (isFinite(offset)) {
          offset = offset >>> 0;
          if (isFinite(length)) {
            length = length >>> 0;
            if (encoding === void 0) encoding = "utf8";
          } else {
            encoding = length;
            length = void 0;
          }
        } else {
          throw new Error(
            "Buffer.write(string, encoding, offset[, length]) is no longer supported"
          );
        }
        const remaining = this.length - offset;
        if (length === void 0 || length > remaining) length = remaining;
        if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
          throw new RangeError("Attempt to write outside buffer bounds");
        }
        if (!encoding) encoding = "utf8";
        let loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "hex":
              return hexWrite(this, string, offset, length);
            case "utf8":
            case "utf-8":
              return utf8Write(this, string, offset, length);
            case "ascii":
            case "latin1":
            case "binary":
              return asciiWrite(this, string, offset, length);
            case "base64":
              return base64Write(this, string, offset, length);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return ucs2Write(this, string, offset, length);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      };
      Buffer6.prototype.toJSON = function toJSON() {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        };
      };
      function base64Slice(buf, start, end) {
        if (start === 0 && end === buf.length) {
          return base64.fromByteArray(buf);
        } else {
          return base64.fromByteArray(buf.slice(start, end));
        }
      }
      function utf8Slice(buf, start, end) {
        end = Math.min(buf.length, end);
        const res = [];
        let i = start;
        while (i < end) {
          const firstByte = buf[i];
          let codePoint = null;
          let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
          if (i + bytesPerSequence <= end) {
            let secondByte, thirdByte, fourthByte, tempCodePoint;
            switch (bytesPerSequence) {
              case 1:
                if (firstByte < 128) {
                  codePoint = firstByte;
                }
                break;
              case 2:
                secondByte = buf[i + 1];
                if ((secondByte & 192) === 128) {
                  tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                  if (tempCodePoint > 127) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 3:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                  if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 4:
                secondByte = buf[i + 1];
                thirdByte = buf[i + 2];
                fourthByte = buf[i + 3];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                  if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                    codePoint = tempCodePoint;
                  }
                }
            }
          }
          if (codePoint === null) {
            codePoint = 65533;
            bytesPerSequence = 1;
          } else if (codePoint > 65535) {
            codePoint -= 65536;
            res.push(codePoint >>> 10 & 1023 | 55296);
            codePoint = 56320 | codePoint & 1023;
          }
          res.push(codePoint);
          i += bytesPerSequence;
        }
        return decodeCodePointsArray(res);
      }
      var MAX_ARGUMENTS_LENGTH = 4096;
      function decodeCodePointsArray(codePoints) {
        const len = codePoints.length;
        if (len <= MAX_ARGUMENTS_LENGTH) {
          return String.fromCharCode.apply(String, codePoints);
        }
        let res = "";
        let i = 0;
        while (i < len) {
          res += String.fromCharCode.apply(
            String,
            codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
          );
        }
        return res;
      }
      function asciiSlice(buf, start, end) {
        let ret = "";
        end = Math.min(buf.length, end);
        for (let i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i] & 127);
        }
        return ret;
      }
      function latin1Slice(buf, start, end) {
        let ret = "";
        end = Math.min(buf.length, end);
        for (let i = start; i < end; ++i) {
          ret += String.fromCharCode(buf[i]);
        }
        return ret;
      }
      function hexSlice(buf, start, end) {
        const len = buf.length;
        if (!start || start < 0) start = 0;
        if (!end || end < 0 || end > len) end = len;
        let out = "";
        for (let i = start; i < end; ++i) {
          out += hexSliceLookupTable[buf[i]];
        }
        return out;
      }
      function utf16leSlice(buf, start, end) {
        const bytes = buf.slice(start, end);
        let res = "";
        for (let i = 0; i < bytes.length - 1; i += 2) {
          res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
        }
        return res;
      }
      Buffer6.prototype.slice = function slice(start, end) {
        const len = this.length;
        start = ~~start;
        end = end === void 0 ? len : ~~end;
        if (start < 0) {
          start += len;
          if (start < 0) start = 0;
        } else if (start > len) {
          start = len;
        }
        if (end < 0) {
          end += len;
          if (end < 0) end = 0;
        } else if (end > len) {
          end = len;
        }
        if (end < start) end = start;
        const newBuf = this.subarray(start, end);
        Object.setPrototypeOf(newBuf, Buffer6.prototype);
        return newBuf;
      };
      function checkOffset(offset, ext, length) {
        if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
        if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
      }
      Buffer6.prototype.readUintLE = Buffer6.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength2, this.length);
        let val = this[offset];
        let mul = 1;
        let i = 0;
        while (++i < byteLength2 && (mul *= 256)) {
          val += this[offset + i] * mul;
        }
        return val;
      };
      Buffer6.prototype.readUintBE = Buffer6.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          checkOffset(offset, byteLength2, this.length);
        }
        let val = this[offset + --byteLength2];
        let mul = 1;
        while (byteLength2 > 0 && (mul *= 256)) {
          val += this[offset + --byteLength2] * mul;
        }
        return val;
      };
      Buffer6.prototype.readUint8 = Buffer6.prototype.readUInt8 = function readUInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 1, this.length);
        return this[offset];
      };
      Buffer6.prototype.readUint16LE = Buffer6.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] | this[offset + 1] << 8;
      };
      Buffer6.prototype.readUint16BE = Buffer6.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        return this[offset] << 8 | this[offset + 1];
      };
      Buffer6.prototype.readUint32LE = Buffer6.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
      };
      Buffer6.prototype.readUint32BE = Buffer6.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
      };
      Buffer6.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
        const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
        return BigInt(lo) + (BigInt(hi) << BigInt(32));
      });
      Buffer6.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
        const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
        return (BigInt(hi) << BigInt(32)) + BigInt(lo);
      });
      Buffer6.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength2, this.length);
        let val = this[offset];
        let mul = 1;
        let i = 0;
        while (++i < byteLength2 && (mul *= 256)) {
          val += this[offset + i] * mul;
        }
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
        return val;
      };
      Buffer6.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset, byteLength2, this.length);
        let i = byteLength2;
        let mul = 1;
        let val = this[offset + --i];
        while (i > 0 && (mul *= 256)) {
          val += this[offset + --i] * mul;
        }
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
        return val;
      };
      Buffer6.prototype.readInt8 = function readInt8(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 1, this.length);
        if (!(this[offset] & 128)) return this[offset];
        return (255 - this[offset] + 1) * -1;
      };
      Buffer6.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        const val = this[offset] | this[offset + 1] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer6.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 2, this.length);
        const val = this[offset + 1] | this[offset] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer6.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
      };
      Buffer6.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
      };
      Buffer6.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
        return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
      });
      Buffer6.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset) {
        offset = offset >>> 0;
        validateNumber(offset, "offset");
        const first = this[offset];
        const last = this[offset + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset, this.length - 8);
        }
        const val = (first << 24) + // Overflow
        this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
        return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
      });
      Buffer6.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, true, 23, 4);
      };
      Buffer6.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 4, this.length);
        return ieee754.read(this, offset, false, 23, 4);
      };
      Buffer6.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, true, 52, 8);
      };
      Buffer6.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
        offset = offset >>> 0;
        if (!noAssert) checkOffset(offset, 8, this.length);
        return ieee754.read(this, offset, false, 52, 8);
      };
      function checkInt(buf, value, offset, ext, max2, min) {
        if (!Buffer6.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
        if (value > max2 || value < min) throw new RangeError('"value" argument is out of bounds');
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
      }
      Buffer6.prototype.writeUintLE = Buffer6.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset, byteLength2, maxBytes, 0);
        }
        let mul = 1;
        let i = 0;
        this[offset] = value & 255;
        while (++i < byteLength2 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength2;
      };
      Buffer6.prototype.writeUintBE = Buffer6.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset, byteLength2, maxBytes, 0);
        }
        let i = byteLength2 - 1;
        let mul = 1;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          this[offset + i] = value / mul & 255;
        }
        return offset + byteLength2;
      };
      Buffer6.prototype.writeUint8 = Buffer6.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer6.prototype.writeUint16LE = Buffer6.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer6.prototype.writeUint16BE = Buffer6.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer6.prototype.writeUint32LE = Buffer6.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset + 3] = value >>> 24;
        this[offset + 2] = value >>> 16;
        this[offset + 1] = value >>> 8;
        this[offset] = value & 255;
        return offset + 4;
      };
      Buffer6.prototype.writeUint32BE = Buffer6.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      function wrtBigUInt64LE(buf, value, offset, min, max2) {
        checkIntBI(value, min, max2, buf, offset, 7);
        let lo = Number(value & BigInt(4294967295));
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        lo = lo >> 8;
        buf[offset++] = lo;
        let hi = Number(value >> BigInt(32) & BigInt(4294967295));
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        hi = hi >> 8;
        buf[offset++] = hi;
        return offset;
      }
      function wrtBigUInt64BE(buf, value, offset, min, max2) {
        checkIntBI(value, min, max2, buf, offset, 7);
        let lo = Number(value & BigInt(4294967295));
        buf[offset + 7] = lo;
        lo = lo >> 8;
        buf[offset + 6] = lo;
        lo = lo >> 8;
        buf[offset + 5] = lo;
        lo = lo >> 8;
        buf[offset + 4] = lo;
        let hi = Number(value >> BigInt(32) & BigInt(4294967295));
        buf[offset + 3] = hi;
        hi = hi >> 8;
        buf[offset + 2] = hi;
        hi = hi >> 8;
        buf[offset + 1] = hi;
        hi = hi >> 8;
        buf[offset] = hi;
        return offset + 8;
      }
      Buffer6.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset = 0) {
        return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
      });
      Buffer6.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset = 0) {
        return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
      });
      Buffer6.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          const limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset, byteLength2, limit - 1, -limit);
        }
        let i = 0;
        let mul = 1;
        let sub = 0;
        this[offset] = value & 255;
        while (++i < byteLength2 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength2;
      };
      Buffer6.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          const limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset, byteLength2, limit - 1, -limit);
        }
        let i = byteLength2 - 1;
        let mul = 1;
        let sub = 0;
        this[offset + i] = value & 255;
        while (--i >= 0 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
            sub = 1;
          }
          this[offset + i] = (value / mul >> 0) - sub & 255;
        }
        return offset + byteLength2;
      };
      Buffer6.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
        if (value < 0) value = 255 + value + 1;
        this[offset] = value & 255;
        return offset + 1;
      };
      Buffer6.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        return offset + 2;
      };
      Buffer6.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
        this[offset] = value >>> 8;
        this[offset + 1] = value & 255;
        return offset + 2;
      };
      Buffer6.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        this[offset] = value & 255;
        this[offset + 1] = value >>> 8;
        this[offset + 2] = value >>> 16;
        this[offset + 3] = value >>> 24;
        return offset + 4;
      };
      Buffer6.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
        if (value < 0) value = 4294967295 + value + 1;
        this[offset] = value >>> 24;
        this[offset + 1] = value >>> 16;
        this[offset + 2] = value >>> 8;
        this[offset + 3] = value & 255;
        return offset + 4;
      };
      Buffer6.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset = 0) {
        return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
      });
      Buffer6.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset = 0) {
        return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
      });
      function checkIEEE754(buf, value, offset, ext, max2, min) {
        if (offset + ext > buf.length) throw new RangeError("Index out of range");
        if (offset < 0) throw new RangeError("Index out of range");
      }
      function writeFloat(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
        }
        ieee754.write(buf, value, offset, littleEndian, 23, 4);
        return offset + 4;
      }
      Buffer6.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
        return writeFloat(this, value, offset, true, noAssert);
      };
      Buffer6.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
        return writeFloat(this, value, offset, false, noAssert);
      };
      function writeDouble(buf, value, offset, littleEndian, noAssert) {
        value = +value;
        offset = offset >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
        }
        ieee754.write(buf, value, offset, littleEndian, 52, 8);
        return offset + 8;
      }
      Buffer6.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
        return writeDouble(this, value, offset, true, noAssert);
      };
      Buffer6.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
        return writeDouble(this, value, offset, false, noAssert);
      };
      Buffer6.prototype.copy = function copy(target, targetStart, start, end) {
        if (!Buffer6.isBuffer(target)) throw new TypeError("argument should be a Buffer");
        if (!start) start = 0;
        if (!end && end !== 0) end = this.length;
        if (targetStart >= target.length) targetStart = target.length;
        if (!targetStart) targetStart = 0;
        if (end > 0 && end < start) end = start;
        if (end === start) return 0;
        if (target.length === 0 || this.length === 0) return 0;
        if (targetStart < 0) {
          throw new RangeError("targetStart out of bounds");
        }
        if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
        if (end < 0) throw new RangeError("sourceEnd out of bounds");
        if (end > this.length) end = this.length;
        if (target.length - targetStart < end - start) {
          end = target.length - targetStart + start;
        }
        const len = end - start;
        if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
          this.copyWithin(targetStart, start, end);
        } else {
          Uint8Array.prototype.set.call(
            target,
            this.subarray(start, end),
            targetStart
          );
        }
        return len;
      };
      Buffer6.prototype.fill = function fill(val, start, end, encoding) {
        if (typeof val === "string") {
          if (typeof start === "string") {
            encoding = start;
            start = 0;
            end = this.length;
          } else if (typeof end === "string") {
            encoding = end;
            end = this.length;
          }
          if (encoding !== void 0 && typeof encoding !== "string") {
            throw new TypeError("encoding must be a string");
          }
          if (typeof encoding === "string" && !Buffer6.isEncoding(encoding)) {
            throw new TypeError("Unknown encoding: " + encoding);
          }
          if (val.length === 1) {
            const code = val.charCodeAt(0);
            if (encoding === "utf8" && code < 128 || encoding === "latin1") {
              val = code;
            }
          }
        } else if (typeof val === "number") {
          val = val & 255;
        } else if (typeof val === "boolean") {
          val = Number(val);
        }
        if (start < 0 || this.length < start || this.length < end) {
          throw new RangeError("Out of range index");
        }
        if (end <= start) {
          return this;
        }
        start = start >>> 0;
        end = end === void 0 ? this.length : end >>> 0;
        if (!val) val = 0;
        let i;
        if (typeof val === "number") {
          for (i = start; i < end; ++i) {
            this[i] = val;
          }
        } else {
          const bytes = Buffer6.isBuffer(val) ? val : Buffer6.from(val, encoding);
          const len = bytes.length;
          if (len === 0) {
            throw new TypeError('The value "' + val + '" is invalid for argument "value"');
          }
          for (i = 0; i < end - start; ++i) {
            this[i + start] = bytes[i % len];
          }
        }
        return this;
      };
      var errors = {};
      function E(sym, getMessage, Base) {
        errors[sym] = class NodeError extends Base {
          constructor() {
            super();
            Object.defineProperty(this, "message", {
              value: getMessage.apply(this, arguments),
              writable: true,
              configurable: true
            });
            this.name = `${this.name} [${sym}]`;
            this.stack;
            delete this.name;
          }
          get code() {
            return sym;
          }
          set code(value) {
            Object.defineProperty(this, "code", {
              configurable: true,
              enumerable: true,
              value,
              writable: true
            });
          }
          toString() {
            return `${this.name} [${sym}]: ${this.message}`;
          }
        };
      }
      E(
        "ERR_BUFFER_OUT_OF_BOUNDS",
        function(name) {
          if (name) {
            return `${name} is outside of buffer bounds`;
          }
          return "Attempt to access memory outside buffer bounds";
        },
        RangeError
      );
      E(
        "ERR_INVALID_ARG_TYPE",
        function(name, actual) {
          return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
        },
        TypeError
      );
      E(
        "ERR_OUT_OF_RANGE",
        function(str, range, input) {
          let msg = `The value of "${str}" is out of range.`;
          let received = input;
          if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
            received = addNumericalSeparator(String(input));
          } else if (typeof input === "bigint") {
            received = String(input);
            if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
              received = addNumericalSeparator(received);
            }
            received += "n";
          }
          msg += ` It must be ${range}. Received ${received}`;
          return msg;
        },
        RangeError
      );
      function addNumericalSeparator(val) {
        let res = "";
        let i = val.length;
        const start = val[0] === "-" ? 1 : 0;
        for (; i >= start + 4; i -= 3) {
          res = `_${val.slice(i - 3, i)}${res}`;
        }
        return `${val.slice(0, i)}${res}`;
      }
      function checkBounds(buf, offset, byteLength2) {
        validateNumber(offset, "offset");
        if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
          boundsError(offset, buf.length - (byteLength2 + 1));
        }
      }
      function checkIntBI(value, min, max2, buf, offset, byteLength2) {
        if (value > max2 || value < min) {
          const n = typeof min === "bigint" ? "n" : "";
          let range;
          if (byteLength2 > 3) {
            if (min === 0 || min === BigInt(0)) {
              range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
            } else {
              range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
            }
          } else {
            range = `>= ${min}${n} and <= ${max2}${n}`;
          }
          throw new errors.ERR_OUT_OF_RANGE("value", range, value);
        }
        checkBounds(buf, offset, byteLength2);
      }
      function validateNumber(value, name) {
        if (typeof value !== "number") {
          throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
        }
      }
      function boundsError(value, length, type) {
        if (Math.floor(value) !== value) {
          validateNumber(value, type);
          throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
        }
        if (length < 0) {
          throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
        }
        throw new errors.ERR_OUT_OF_RANGE(
          type || "offset",
          `>= ${type ? 1 : 0} and <= ${length}`,
          value
        );
      }
      var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
      function base64clean(str) {
        str = str.split("=")[0];
        str = str.trim().replace(INVALID_BASE64_RE, "");
        if (str.length < 2) return "";
        while (str.length % 4 !== 0) {
          str = str + "=";
        }
        return str;
      }
      function utf8ToBytes(string, units) {
        units = units || Infinity;
        let codePoint;
        const length = string.length;
        let leadSurrogate = null;
        const bytes = [];
        for (let i = 0; i < length; ++i) {
          codePoint = string.charCodeAt(i);
          if (codePoint > 55295 && codePoint < 57344) {
            if (!leadSurrogate) {
              if (codePoint > 56319) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              } else if (i + 1 === length) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              }
              leadSurrogate = codePoint;
              continue;
            }
            if (codePoint < 56320) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              leadSurrogate = codePoint;
              continue;
            }
            codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
          } else if (leadSurrogate) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
          }
          leadSurrogate = null;
          if (codePoint < 128) {
            if ((units -= 1) < 0) break;
            bytes.push(codePoint);
          } else if (codePoint < 2048) {
            if ((units -= 2) < 0) break;
            bytes.push(
              codePoint >> 6 | 192,
              codePoint & 63 | 128
            );
          } else if (codePoint < 65536) {
            if ((units -= 3) < 0) break;
            bytes.push(
              codePoint >> 12 | 224,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else if (codePoint < 1114112) {
            if ((units -= 4) < 0) break;
            bytes.push(
              codePoint >> 18 | 240,
              codePoint >> 12 & 63 | 128,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else {
            throw new Error("Invalid code point");
          }
        }
        return bytes;
      }
      function asciiToBytes(str) {
        const byteArray = [];
        for (let i = 0; i < str.length; ++i) {
          byteArray.push(str.charCodeAt(i) & 255);
        }
        return byteArray;
      }
      function utf16leToBytes(str, units) {
        let c, hi, lo;
        const byteArray = [];
        for (let i = 0; i < str.length; ++i) {
          if ((units -= 2) < 0) break;
          c = str.charCodeAt(i);
          hi = c >> 8;
          lo = c % 256;
          byteArray.push(lo);
          byteArray.push(hi);
        }
        return byteArray;
      }
      function base64ToBytes(str) {
        return base64.toByteArray(base64clean(str));
      }
      function blitBuffer(src, dst, offset, length) {
        let i;
        for (i = 0; i < length; ++i) {
          if (i + offset >= dst.length || i >= src.length) break;
          dst[i + offset] = src[i];
        }
        return i;
      }
      function isInstance(obj, type) {
        return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
      }
      function numberIsNaN(obj) {
        return obj !== obj;
      }
      var hexSliceLookupTable = (function() {
        const alphabet = "0123456789abcdef";
        const table = new Array(256);
        for (let i = 0; i < 16; ++i) {
          const i16 = i * 16;
          for (let j = 0; j < 16; ++j) {
            table[i16 + j] = alphabet[i] + alphabet[j];
          }
        }
        return table;
      })();
      function defineBigIntMethod(fn) {
        return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
      }
      function BufferBigIntNotDefined() {
        throw new Error("BigInt not supported");
      }
    }
  });

  // shims/buffer-global.js
  var import_buffer;
  var init_buffer_global = __esm({
    "shims/buffer-global.js"() {
      import_buffer = __toESM(require_buffer());
    }
  });

  // shims/fs.js
  var fs_exports = {};
  __export(fs_exports, {
    closeSync: () => closeSync,
    default: () => fs_default,
    existsSync: () => existsSync,
    fstatSync: () => fstatSync,
    mkdirSync: () => mkdirSync,
    openSync: () => openSync,
    readFileSync: () => readFileSync,
    readSync: () => readSync,
    readdirSync: () => readdirSync,
    renameSync: () => renameSync,
    statSync: () => statSync,
    vfs: () => vfs,
    writeFileSync: () => writeFileSync
  });
  function need(name) {
    const b = files.get(String(name));
    if (!b) {
      const e = new Error("ENOENT: " + name);
      e.code = "ENOENT";
      throw e;
    }
    return b;
  }
  function existsSync(name) {
    return files.has(String(name));
  }
  function readFileSync(name, enc) {
    const b = need(name);
    return enc ? b.toString(enc) : b;
  }
  function statSync(name) {
    const b = need(name);
    return { size: b.length, mtimeMs: 0, isFile: () => true, isDirectory: () => false };
  }
  function openSync(name) {
    need(name);
    const fd2 = nextFd++;
    fds.set(fd2, String(name));
    return fd2;
  }
  function fstatSync(fd2) {
    return statSync(fds.get(fd2));
  }
  function readSync(fd2, buf, off, len, pos) {
    const b = need(fds.get(fd2));
    const n = Math.max(0, Math.min(len, b.length - pos));
    b.copy(buf, off, pos, pos + n);
    return n;
  }
  function closeSync(fd2) {
    fds.delete(fd2);
  }
  function nope(name) {
    return () => {
      throw new Error("\uC6F9\uD310\uC5D0\uC11C\uB294 " + name + " \uB97C \uC4F8 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");
    };
  }
  var import_buffer2, files, fds, nextFd, vfs, writeFileSync, mkdirSync, renameSync, readdirSync, fs_default;
  var init_fs = __esm({
    "shims/fs.js"() {
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      import_buffer2 = __toESM(require_buffer());
      files = /* @__PURE__ */ new Map();
      fds = /* @__PURE__ */ new Map();
      nextFd = 3;
      vfs = {
        put(name, bytes) {
          files.set(String(name), import_buffer2.Buffer.from(bytes));
          return String(name);
        },
        drop(name) {
          files.delete(String(name));
        },
        clear() {
          files.clear();
          fds.clear();
        },
        has(name) {
          return files.has(String(name));
        }
      };
      writeFileSync = nope("writeFileSync");
      mkdirSync = nope("mkdirSync");
      renameSync = nope("renameSync");
      readdirSync = nope("readdirSync");
      fs_default = {
        vfs,
        existsSync,
        readFileSync,
        statSync,
        openSync,
        fstatSync,
        readSync,
        closeSync,
        writeFileSync,
        mkdirSync,
        renameSync,
        readdirSync
      };
    }
  });

  // ../../개인정보지우개/lib/detect.js
  var require_detect = __commonJS({
    "../../\uAC1C\uC778\uC815\uBCF4\uC9C0\uC6B0\uAC1C/lib/detect.js"(exports, module) {
      "use strict";
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      var RRN_WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
      function rrnChecksum(digits) {
        let sum = 0;
        for (let i = 0; i < 12; i++) sum += Number(digits[i]) * RRN_WEIGHTS[i];
        return (11 - sum % 11) % 10;
      }
      function rrnDateOk(digits) {
        const mm = Number(digits.slice(2, 4));
        const dd = Number(digits.slice(4, 6));
        return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
      }
      function rrnGrade(digits) {
        if (digits.length !== 13) return null;
        if (!rrnDateOk(digits)) return null;
        const g = Number(digits[6]);
        if (!(g >= 0 && g <= 9)) return null;
        if (digits === "0".repeat(13) || /^(\d)\1{12}$/.test(digits)) return null;
        return rrnChecksum(digits) === Number(digits[12]) ? "sure" : "maybe";
      }
      function isForeigner(digits) {
        const g = Number(digits[6]);
        return g >= 5 && g <= 8;
      }
      function luhnOk(digits) {
        let sum = 0;
        let dbl = false;
        for (let i = digits.length - 1; i >= 0; i--) {
          let d = Number(digits[i]);
          if (dbl) {
            d *= 2;
            if (d > 9) d -= 9;
          }
          sum += d;
          dbl = !dbl;
        }
        return digits.length >= 13 && digits.length <= 19 && sum % 10 === 0;
      }
      var BANKS = [
        "\uAD6D\uBBFC",
        "KB",
        "\uC2E0\uD55C",
        "\uC6B0\uB9AC",
        "\uD558\uB098",
        "\uB18D\uD611",
        "NH",
        "\uAE30\uC5C5",
        "IBK",
        "\uC218\uD611",
        "\uC0B0\uC5C5",
        "\uC528\uD2F0",
        "SC",
        "\uC81C\uC77C",
        "\uB300\uAD6C",
        "\uBD80\uC0B0",
        "\uACBD\uB0A8",
        "\uAD11\uC8FC",
        "\uC804\uBD81",
        "\uC81C\uC8FC",
        "\uC6B0\uCCB4\uAD6D",
        "\uC0C8\uB9C8\uC744",
        "\uC2E0\uD611",
        "\uCE74\uCE74\uC624\uBC45\uD06C",
        "\uCF00\uC774\uBC45\uD06C",
        "\uD1A0\uC2A4\uBC45\uD06C",
        "\uD1A0\uC2A4",
        "\uCE74\uCE74\uC624",
        "\uACC4\uC88C",
        "\uC785\uAE08",
        "\uC1A1\uAE08",
        "\uD1B5\uC7A5",
        "\uC608\uAE08\uC8FC",
        "\uC740\uD589"
      ];
      var RULES = [
        {
          id: "rrn",
          name: "\uC8FC\uBBFC\uB4F1\uB85D\uBC88\uD638",
          level: "high",
          ascii: true,
          on: true,
          hint: "\uB4B7\uC790\uB9AC \uAC80\uC0B0\uACFC \uC0DD\uB144\uC6D4\uC77C\uAE4C\uC9C0 \uB9DE\uB294 \uAC83\uB9CC \u201C\uD655\uC2E4\u201D \uB85C \uBD05\uB2C8\uB2E4",
          re: new RegExp("(?<![0-9])(\\d{6})\\s*[-\u2013\u2014]\\s*(\\d{7})(?![0-9])", "g"),
          judge(m) {
            const digits = m[1] + m[2];
            const grade = rrnGrade(digits);
            if (!grade) return null;
            return { grade, label: isForeigner(digits) ? "\uC678\uAD6D\uC778\uB4F1\uB85D\uBC88\uD638" : "\uC8FC\uBBFC\uB4F1\uB85D\uBC88\uD638" };
          },
          mask(m) {
            return m[1] + "-" + "*".repeat(7);
          }
        },
        {
          id: "rrn-tight",
          name: "\uC8FC\uBBFC\uB4F1\uB85D\uBC88\uD638 (\uBD99\uC5EC \uC4F4 13\uC790\uB9AC)",
          level: "high",
          ascii: true,
          on: true,
          hint: "9001011234567 \uCC98\uB7FC \uBD99\uC5EC \uC4F4 \uAC83. \uAC80\uC0B0\uC744 \uD1B5\uACFC\uD55C \uAC83\uB9CC \uC7A1\uC2B5\uB2C8\uB2E4",
          re: new RegExp("(?<![0-9])(\\d{13})(?![0-9])", "g"),
          judge(m) {
            const grade = rrnGrade(m[1]);
            if (grade !== "sure") return null;
            return { grade: "sure", label: isForeigner(m[1]) ? "\uC678\uAD6D\uC778\uB4F1\uB85D\uBC88\uD638" : "\uC8FC\uBBFC\uB4F1\uB85D\uBC88\uD638" };
          },
          mask(m) {
            return m[1].slice(0, 6) + "*".repeat(7);
          }
        },
        {
          id: "phone-mobile",
          name: "\uD734\uB300\uC804\uD654",
          level: "mid",
          ascii: true,
          on: true,
          re: new RegExp("(?<![0-9])(01[016789])[-.\\s]?(\\d{3,4})[-.\\s]?(\\d{4})(?![0-9])", "g"),
          judge() {
            return { grade: "sure", label: "\uD734\uB300\uC804\uD654" };
          },
          mask(m) {
            return m[1] + "-****-" + m[3];
          }
        },
        {
          id: "phone-land",
          name: "\uC77C\uBC18 \uC804\uD654",
          level: "mid",
          ascii: true,
          on: true,
          hint: "\uD559\uAD50 \uB300\uD45C\uBC88\uD638\uB3C4 \uAC78\uB9BD\uB2C8\uB2E4. \uD544\uC694 \uC5C6\uC73C\uBA74 \uB044\uC138\uC694",
          re: new RegExp("(?<![0-9])(0(?:2|[3-6][1-5]|70|50\\d?))[-.\\s](\\d{3,4})[-.\\s](\\d{4})(?![0-9])", "g"),
          judge() {
            return { grade: "sure", label: "\uC77C\uBC18 \uC804\uD654" };
          },
          mask(m) {
            return m[1] + "-****-" + m[3];
          }
        },
        {
          id: "email",
          name: "\uC774\uBA54\uC77C",
          level: "mid",
          ascii: true,
          on: true,
          re: new RegExp("(?<![A-Za-z0-9._%+-])([A-Za-z0-9._%+-]{2,64})@([A-Za-z0-9.-]{2,60}\\.[A-Za-z]{2,12})(?![A-Za-z0-9.-])", "g"),
          judge(m) {
            if (/\.(png|jpg|jpeg|gif|hwp|hwpx|docx?|xlsx?|pptx?|pdf|zip)$/i.test(m[2])) return null;
            return { grade: "sure", label: "\uC774\uBA54\uC77C" };
          },
          mask(m) {
            return m[1][0] + "*".repeat(Math.max(2, m[1].length - 1)) + "@" + m[2];
          }
        },
        {
          id: "card",
          name: "\uCE74\uB4DC\uBC88\uD638",
          level: "high",
          ascii: true,
          on: true,
          hint: "\uB8EC \uAC80\uC0B0\uC744 \uD1B5\uACFC\uD55C \uAC83\uB9CC \uC7A1\uC2B5\uB2C8\uB2E4",
          re: new RegExp("(?<![0-9])(\\d{4})[-.\\s]?(\\d{4})[-.\\s]?(\\d{4})[-.\\s]?(\\d{4})(?![0-9])", "g"),
          judge(m) {
            const digits = m[1] + m[2] + m[3] + m[4];
            if (rrnGrade(digits.slice(0, 13)) === "sure" && digits.length === 16) {
            }
            return luhnOk(digits) ? { grade: "sure", label: "\uCE74\uB4DC\uBC88\uD638" } : null;
          },
          mask(m) {
            return m[1] + "-****-****-" + m[4];
          }
        },
        {
          id: "account",
          name: "\uACC4\uC88C\uBC88\uD638",
          level: "high",
          ascii: false,
          on: true,
          hint: "\uAC00\uAE4C\uC774(\uC55E\uB4A4 40\uC790) \uC740\uD589 \uC774\uB984\uC774\uB098 \u201C\uACC4\uC88C\xB7\uC785\uAE08\u201D \uAC19\uC740 \uB9D0\uC774 \uC788\uC744 \uB54C\uB9CC \uC7A1\uC2B5\uB2C8\uB2E4",
          re: new RegExp("(?<![0-9])(\\d{2,6})-(\\d{2,6})-(\\d{2,8})(?![0-9-])", "g"),
          judge(m, text, at) {
            const near = text.slice(Math.max(0, at - 40), at + m[0].length + 40);
            if (!BANKS.some((b) => near.includes(b))) return null;
            if (/^0\d/.test(m[1])) return null;
            return { grade: "sure", label: "\uACC4\uC88C\uBC88\uD638" };
          },
          mask(m) {
            return m[1] + "-" + "*".repeat(m[2].length) + "-" + "*".repeat(m[3].length);
          }
        },
        {
          id: "passport",
          name: "\uC5EC\uAD8C\uBC88\uD638",
          level: "high",
          ascii: true,
          on: false,
          hint: "\uBB38\uC11C \uBC88\uD638\uC640 \uD5F7\uAC08\uB9B4 \uC218 \uC788\uC5B4 \uAE30\uBCF8\uC73C\uB85C \uAEBC \uB461\uB2C8\uB2E4",
          re: new RegExp("(?<![A-Za-z0-9])([MSRODmsrod])(\\d{8})(?![0-9])", "g"),
          judge() {
            return { grade: "maybe", label: "\uC5EC\uAD8C\uBC88\uD638" };
          },
          mask(m) {
            return m[1].toUpperCase() + "*".repeat(8);
          }
        },
        {
          id: "plate",
          name: "\uCC28\uB7C9\uBC88\uD638",
          level: "low",
          ascii: false,
          on: false,
          hint: "12\uAC003456 \xB7 \uC11C\uC6B812\uAC003456 \uAF34",
          re: new RegExp("(?<![0-9])(\\d{2,3})\\s?([\uAC00-\uD7A3])\\s?(\\d{4})(?![0-9])", "g"),
          judge() {
            return { grade: "maybe", label: "\uCC28\uB7C9\uBC88\uD638" };
          },
          mask(m) {
            return m[1] + m[2] + "*".repeat(4);
          }
        },
        {
          id: "address",
          name: "\uC9D1 \uC8FC\uC18C",
          level: "high",
          ascii: false,
          on: false,
          hint: "\uB3D9\xB7\uB85C\xB7\uAE38 + \uBC88\uC9C0\uAE4C\uC9C0 \uC788\uB294 \uAC83\uB9CC. \uD559\uAD50 \uC8FC\uC18C\uB3C4 \uAC78\uB9AC\uB2C8 \uD655\uC778\uD558\uACE0 \uC4F0\uC138\uC694",
          re: /((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{0,20}?(?:시|군|구)\s*[^\n]{0,24}?(?:동|로|길)\s*\d{1,4}(?:-\d{1,4})?(?:\s*[,·]?\s*\d{1,4}동)?(?:\s*\d{1,5}호)?)/g,
          judge() {
            return { grade: "maybe", label: "\uC9D1 \uC8FC\uC18C" };
          },
          mask(m) {
            return m[1].replace(/\d/g, "*");
          }
        },
        {
          id: "birth",
          name: "\uC0DD\uB144\uC6D4\uC77C",
          level: "low",
          ascii: false,
          on: false,
          hint: "2010\uB144 3\uC6D4 5\uC77C\uC0DD / 2010-03-05 \uAF34. \uB0A0\uC9DC\uAC00 \uB9CE\uC740 \uBB38\uC11C\uC5D0\uC11C\uB294 \uC2DC\uB044\uB7FD\uC2B5\uB2C8\uB2E4",
          re: /((?:19|20)\d{2})\s*[-.년]\s*(0?[1-9]|1[0-2])\s*[-.월]\s*(0?[1-9]|[12]\d|3[01])\s*[일생]?/g,
          judge() {
            return { grade: "maybe", label: "\uC0DD\uB144\uC6D4\uC77C" };
          },
          mask(m) {
            return m[1] + "-**-**";
          }
        }
      ];
      var RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));
      var LEVEL_ORDER = { high: 0, mid: 1, low: 2 };
      function findInText(text, onIds, opts = {}) {
        const src = String(text || "");
        if (!src) return [];
        const want = onIds && onIds.length ? new Set(onIds) : new Set(RULES.filter((r) => r.on).map((r) => r.id));
        const maxPer = opts.maxPerFile || 400;
        const hits = [];
        const taken = [];
        for (const rule of RULES) {
          if (!want.has(rule.id)) continue;
          rule.re.lastIndex = 0;
          let m;
          while ((m = rule.re.exec(src)) !== null) {
            if (m[0].length === 0) {
              rule.re.lastIndex += 1;
              continue;
            }
            const at = m.index;
            const len = m[0].length;
            const verdict = rule.judge(m, src, at);
            if (!verdict) continue;
            if (!opts.wantMaybe && verdict.grade === "maybe") {
            }
            if (taken.some(([a, b]) => at < b && a < at + len)) continue;
            taken.push([at, at + len]);
            hits.push({
              ruleId: rule.id,
              label: verdict.label,
              level: rule.level,
              grade: verdict.grade,
              text: m[0],
              at,
              len,
              masked: rule.mask(m),
              context: contextOf(src, at, len)
            });
            if (hits.length >= maxPer) return sortHits(hits);
          }
        }
        return sortHits(hits);
      }
      function sortHits(hits) {
        return hits.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || (a.grade === b.grade ? 0 : a.grade === "sure" ? -1 : 1) || a.at - b.at);
      }
      function scrubForDisplay(s) {
        return String(s == null ? "" : s).replace(/[A-Za-z0-9._%+-]{2,}@[A-Za-z0-9.-]{2,}/g, (m) => m[0] + "***@***").replace(/\d{3,}/g, (m) => "*".repeat(Math.min(m.length, 7)));
      }
      function contextOf(src, at, len) {
        const from = Math.max(0, at - 26);
        const to = Math.min(src.length, at + len + 26);
        const head = (from > 0 ? "\u2026" : "") + src.slice(from, at);
        const tail = src.slice(at + len, to) + (to < src.length ? "\u2026" : "");
        return {
          before: scrubForDisplay(head.replace(/\s+/g, " ")),
          after: scrubForDisplay(tail.replace(/\s+/g, " "))
        };
      }
      function maskText(text, onIds, opts = {}) {
        const src = String(text || "");
        const want = onIds && onIds.length ? new Set(onIds) : new Set(RULES.filter((r) => r.on).map((r) => r.id));
        const spans = [];
        const taken = [];
        for (const rule of RULES) {
          if (!want.has(rule.id)) continue;
          if (opts.asciiOnly && !rule.ascii) continue;
          rule.re.lastIndex = 0;
          let m;
          while ((m = rule.re.exec(src)) !== null) {
            if (m[0].length === 0) {
              rule.re.lastIndex += 1;
              continue;
            }
            const at = m.index;
            const len = m[0].length;
            if (!rule.judge(m, src, at)) continue;
            if (taken.some(([a, b]) => at < b && a < at + len)) continue;
            taken.push([at, at + len]);
            spans.push({ at, len, to: rule.mask(m), ruleId: rule.id });
          }
        }
        if (!spans.length) return { text: src, changed: 0, byRule: {} };
        spans.sort((a, b) => a.at - b.at);
        let out = "";
        let cursor = 0;
        const byRule = {};
        for (const s of spans) {
          if (s.at < cursor) continue;
          out += src.slice(cursor, s.at) + s.to;
          cursor = s.at + s.len;
          byRule[s.ruleId] = (byRule[s.ruleId] || 0) + 1;
        }
        out += src.slice(cursor);
        return { text: out, changed: spans.length, byRule };
      }
      function ruleList() {
        return RULES.map((r) => ({
          id: r.id,
          name: r.name,
          level: r.level,
          on: r.on,
          hint: r.hint || "",
          ascii: r.ascii
        }));
      }
      function defaultOn() {
        return RULES.filter((r) => r.on).map((r) => r.id);
      }
      module.exports = {
        RULES,
        RULE_BY_ID,
        BANKS,
        rrnChecksum,
        rrnGrade,
        isForeigner,
        luhnOk,
        findInText,
        maskText,
        ruleList,
        defaultOn,
        contextOf,
        scrubForDisplay
      };
    }
  });

  // node_modules/fflate/esm/browser.js
  function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
  }
  function inflateSync(data, opts) {
    return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
  }
  function zlibSync(data, opts) {
    if (!opts)
      opts = {};
    var a = adler();
    a.p(data);
    var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);
    return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
  }
  function unzlibSync(data, opts) {
    return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
  }
  var u8, u16, i32, fleb, fdeb, clim, freb, _a, fl, revfl, _b, fd, revfd, rev, x, i, hMap, flt, i, i, i, i, fdt, i, flm, flrm, fdm, fdrm, max, bits, bits16, shft, slc, ec, err, inflt, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, deo, et, dflt, adler, dopt, wbytes, zlh, zls, td, tds;
  var init_browser = __esm({
    "node_modules/fflate/esm/browser.js"() {
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      u8 = Uint8Array;
      u16 = Uint16Array;
      i32 = Int32Array;
      fleb = new u8([
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1,
        2,
        2,
        2,
        2,
        3,
        3,
        3,
        3,
        4,
        4,
        4,
        4,
        5,
        5,
        5,
        5,
        0,
        /* unused */
        0,
        0,
        /* impossible */
        0
      ]);
      fdeb = new u8([
        0,
        0,
        0,
        0,
        1,
        1,
        2,
        2,
        3,
        3,
        4,
        4,
        5,
        5,
        6,
        6,
        7,
        7,
        8,
        8,
        9,
        9,
        10,
        10,
        11,
        11,
        12,
        12,
        13,
        13,
        /* unused */
        0,
        0
      ]);
      clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
      freb = function(eb, start) {
        var b = new u16(31);
        for (var i = 0; i < 31; ++i) {
          b[i] = start += 1 << eb[i - 1];
        }
        var r = new i32(b[30]);
        for (var i = 1; i < 30; ++i) {
          for (var j = b[i]; j < b[i + 1]; ++j) {
            r[j] = j - b[i] << 5 | i;
          }
        }
        return { b, r };
      };
      _a = freb(fleb, 2);
      fl = _a.b;
      revfl = _a.r;
      fl[28] = 258, revfl[258] = 28;
      _b = freb(fdeb, 0);
      fd = _b.b;
      revfd = _b.r;
      rev = new u16(32768);
      for (i = 0; i < 32768; ++i) {
        x = (i & 43690) >> 1 | (i & 21845) << 1;
        x = (x & 52428) >> 2 | (x & 13107) << 2;
        x = (x & 61680) >> 4 | (x & 3855) << 4;
        rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
      }
      hMap = (function(cd, mb, r) {
        var s = cd.length;
        var i = 0;
        var l = new u16(mb);
        for (; i < s; ++i) {
          if (cd[i])
            ++l[cd[i] - 1];
        }
        var le = new u16(mb);
        for (i = 1; i < mb; ++i) {
          le[i] = le[i - 1] + l[i - 1] << 1;
        }
        var co;
        if (r) {
          co = new u16(1 << mb);
          var rvb = 15 - mb;
          for (i = 0; i < s; ++i) {
            if (cd[i]) {
              var sv = i << 4 | cd[i];
              var r_1 = mb - cd[i];
              var v = le[cd[i] - 1]++ << r_1;
              for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
                co[rev[v] >> rvb] = sv;
              }
            }
          }
        } else {
          co = new u16(s);
          for (i = 0; i < s; ++i) {
            if (cd[i]) {
              co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
            }
          }
        }
        return co;
      });
      flt = new u8(288);
      for (i = 0; i < 144; ++i)
        flt[i] = 8;
      for (i = 144; i < 256; ++i)
        flt[i] = 9;
      for (i = 256; i < 280; ++i)
        flt[i] = 7;
      for (i = 280; i < 288; ++i)
        flt[i] = 8;
      fdt = new u8(32);
      for (i = 0; i < 32; ++i)
        fdt[i] = 5;
      flm = /* @__PURE__ */ hMap(flt, 9, 0);
      flrm = /* @__PURE__ */ hMap(flt, 9, 1);
      fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
      fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
      max = function(a) {
        var m = a[0];
        for (var i = 1; i < a.length; ++i) {
          if (a[i] > m)
            m = a[i];
        }
        return m;
      };
      bits = function(d, p, m) {
        var o = p / 8 | 0;
        return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
      };
      bits16 = function(d, p) {
        var o = p / 8 | 0;
        return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
      };
      shft = function(p) {
        return (p + 7) / 8 | 0;
      };
      slc = function(v, s, e) {
        if (s == null || s < 0)
          s = 0;
        if (e == null || e > v.length)
          e = v.length;
        return new u8(v.subarray(s, e));
      };
      ec = [
        "unexpected EOF",
        "invalid block type",
        "invalid length/literal",
        "invalid distance",
        "stream finished",
        "no stream handler",
        ,
        "no callback",
        "invalid UTF-8 data",
        "extra field too long",
        "date not in range 1980-2099",
        "filename too long",
        "stream finishing",
        "invalid zip data"
        // determined by unknown compression method
      ];
      err = function(ind, msg, nt) {
        var e = new Error(msg || ec[ind]);
        e.code = ind;
        if (Error.captureStackTrace)
          Error.captureStackTrace(e, err);
        if (!nt)
          throw e;
        return e;
      };
      inflt = function(dat, st, buf, dict) {
        var sl = dat.length, dl = dict ? dict.length : 0;
        if (!sl || st.f && !st.l)
          return buf || new u8(0);
        var noBuf = !buf;
        var resize = noBuf || st.i != 2;
        var noSt = st.i;
        if (noBuf)
          buf = new u8(sl * 3);
        var cbuf = function(l2) {
          var bl = buf.length;
          if (l2 > bl) {
            var nbuf = new u8(Math.max(bl * 2, l2));
            nbuf.set(buf);
            buf = nbuf;
          }
        };
        var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
        var tbts = sl * 8;
        do {
          if (!lm) {
            final = bits(dat, pos, 1);
            var type = bits(dat, pos + 1, 3);
            pos += 3;
            if (!type) {
              var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
              if (t > sl) {
                if (noSt)
                  err(0);
                break;
              }
              if (resize)
                cbuf(bt + l);
              buf.set(dat.subarray(s, t), bt);
              st.b = bt += l, st.p = pos = t * 8, st.f = final;
              continue;
            } else if (type == 1)
              lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
            else if (type == 2) {
              var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
              var tl = hLit + bits(dat, pos + 5, 31) + 1;
              pos += 14;
              var ldt = new u8(tl);
              var clt = new u8(19);
              for (var i = 0; i < hcLen; ++i) {
                clt[clim[i]] = bits(dat, pos + i * 3, 7);
              }
              pos += hcLen * 3;
              var clb = max(clt), clbmsk = (1 << clb) - 1;
              var clm = hMap(clt, clb, 1);
              for (var i = 0; i < tl; ) {
                var r = clm[bits(dat, pos, clbmsk)];
                pos += r & 15;
                var s = r >> 4;
                if (s < 16) {
                  ldt[i++] = s;
                } else {
                  var c = 0, n = 0;
                  if (s == 16)
                    n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
                  else if (s == 17)
                    n = 3 + bits(dat, pos, 7), pos += 3;
                  else if (s == 18)
                    n = 11 + bits(dat, pos, 127), pos += 7;
                  while (n--)
                    ldt[i++] = c;
                }
              }
              var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
              lbt = max(lt);
              dbt = max(dt);
              lm = hMap(lt, lbt, 1);
              dm = hMap(dt, dbt, 1);
            } else
              err(1);
            if (pos > tbts) {
              if (noSt)
                err(0);
              break;
            }
          }
          if (resize)
            cbuf(bt + 131072);
          var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
          var lpos = pos;
          for (; ; lpos = pos) {
            var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
            pos += c & 15;
            if (pos > tbts) {
              if (noSt)
                err(0);
              break;
            }
            if (!c)
              err(2);
            if (sym < 256)
              buf[bt++] = sym;
            else if (sym == 256) {
              lpos = pos, lm = null;
              break;
            } else {
              var add = sym - 254;
              if (sym > 264) {
                var i = sym - 257, b = fleb[i];
                add = bits(dat, pos, (1 << b) - 1) + fl[i];
                pos += b;
              }
              var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
              if (!d)
                err(3);
              pos += d & 15;
              var dt = fd[dsym];
              if (dsym > 3) {
                var b = fdeb[dsym];
                dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
              }
              if (pos > tbts) {
                if (noSt)
                  err(0);
                break;
              }
              if (resize)
                cbuf(bt + 131072);
              var end = bt + add;
              if (bt < dt) {
                var shift = dl - dt, dend = Math.min(dt, end);
                if (shift + bt < 0)
                  err(3);
                for (; bt < dend; ++bt)
                  buf[bt] = dict[shift + bt];
              }
              for (; bt < end; ++bt)
                buf[bt] = buf[bt - dt];
            }
          }
          st.l = lm, st.p = lpos, st.b = bt, st.f = final;
          if (lm)
            final = 1, st.m = lbt, st.d = dm, st.n = dbt;
        } while (!final);
        return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
      };
      wbits = function(d, p, v) {
        v <<= p & 7;
        var o = p / 8 | 0;
        d[o] |= v;
        d[o + 1] |= v >> 8;
      };
      wbits16 = function(d, p, v) {
        v <<= p & 7;
        var o = p / 8 | 0;
        d[o] |= v;
        d[o + 1] |= v >> 8;
        d[o + 2] |= v >> 16;
      };
      hTree = function(d, mb) {
        var t = [];
        for (var i = 0; i < d.length; ++i) {
          if (d[i])
            t.push({ s: i, f: d[i] });
        }
        var s = t.length;
        var t2 = t.slice();
        if (!s)
          return { t: et, l: 0 };
        if (s == 1) {
          var v = new u8(t[0].s + 1);
          v[t[0].s] = 1;
          return { t: v, l: 1 };
        }
        t.sort(function(a, b) {
          return a.f - b.f;
        });
        t.push({ s: -1, f: 25001 });
        var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
        t[0] = { s: -1, f: l.f + r.f, l, r };
        while (i1 != s - 1) {
          l = t[t[i0].f < t[i2].f ? i0++ : i2++];
          r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
          t[i1++] = { s: -1, f: l.f + r.f, l, r };
        }
        var maxSym = t2[0].s;
        for (var i = 1; i < s; ++i) {
          if (t2[i].s > maxSym)
            maxSym = t2[i].s;
        }
        var tr = new u16(maxSym + 1);
        var mbt = ln(t[i1 - 1], tr, 0);
        if (mbt > mb) {
          var i = 0, dt = 0;
          var lft = mbt - mb, cst = 1 << lft;
          t2.sort(function(a, b) {
            return tr[b.s] - tr[a.s] || a.f - b.f;
          });
          for (; i < s; ++i) {
            var i2_1 = t2[i].s;
            if (tr[i2_1] > mb) {
              dt += cst - (1 << mbt - tr[i2_1]);
              tr[i2_1] = mb;
            } else
              break;
          }
          dt >>= lft;
          while (dt > 0) {
            var i2_2 = t2[i].s;
            if (tr[i2_2] < mb)
              dt -= 1 << mb - tr[i2_2]++ - 1;
            else
              ++i;
          }
          for (; i >= 0 && dt; --i) {
            var i2_3 = t2[i].s;
            if (tr[i2_3] == mb) {
              --tr[i2_3];
              ++dt;
            }
          }
          mbt = mb;
        }
        return { t: new u8(tr), l: mbt };
      };
      ln = function(n, l, d) {
        return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
      };
      lc = function(c) {
        var s = c.length;
        while (s && !c[--s])
          ;
        var cl = new u16(++s);
        var cli = 0, cln = c[0], cls = 1;
        var w = function(v) {
          cl[cli++] = v;
        };
        for (var i = 1; i <= s; ++i) {
          if (c[i] == cln && i != s)
            ++cls;
          else {
            if (!cln && cls > 2) {
              for (; cls > 138; cls -= 138)
                w(32754);
              if (cls > 2) {
                w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
                cls = 0;
              }
            } else if (cls > 3) {
              w(cln), --cls;
              for (; cls > 6; cls -= 6)
                w(8304);
              if (cls > 2)
                w(cls - 3 << 5 | 8208), cls = 0;
            }
            while (cls--)
              w(cln);
            cls = 1;
            cln = c[i];
          }
        }
        return { c: cl.subarray(0, cli), n: s };
      };
      clen = function(cf, cl) {
        var l = 0;
        for (var i = 0; i < cl.length; ++i)
          l += cf[i] * cl[i];
        return l;
      };
      wfblk = function(out, pos, dat) {
        var s = dat.length;
        var o = shft(pos + 2);
        out[o] = s & 255;
        out[o + 1] = s >> 8;
        out[o + 2] = out[o] ^ 255;
        out[o + 3] = out[o + 1] ^ 255;
        for (var i = 0; i < s; ++i)
          out[o + i + 4] = dat[i];
        return (o + 4 + s) * 8;
      };
      wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
        wbits(out, p++, final);
        ++lf[256];
        var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
        var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
        var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
        var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
        var lcfreq = new u16(19);
        for (var i = 0; i < lclt.length; ++i)
          ++lcfreq[lclt[i] & 31];
        for (var i = 0; i < lcdt.length; ++i)
          ++lcfreq[lcdt[i] & 31];
        var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
        var nlcc = 19;
        for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
          ;
        var flen = bl + 5 << 3;
        var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
        var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
        if (bs >= 0 && flen <= ftlen && flen <= dtlen)
          return wfblk(out, p, dat.subarray(bs, bs + bl));
        var lm, ll, dm, dl;
        wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
        if (dtlen < ftlen) {
          lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
          var llm = hMap(lct, mlcb, 0);
          wbits(out, p, nlc - 257);
          wbits(out, p + 5, ndc - 1);
          wbits(out, p + 10, nlcc - 4);
          p += 14;
          for (var i = 0; i < nlcc; ++i)
            wbits(out, p + 3 * i, lct[clim[i]]);
          p += 3 * nlcc;
          var lcts = [lclt, lcdt];
          for (var it = 0; it < 2; ++it) {
            var clct = lcts[it];
            for (var i = 0; i < clct.length; ++i) {
              var len = clct[i] & 31;
              wbits(out, p, llm[len]), p += lct[len];
              if (len > 15)
                wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
            }
          }
        } else {
          lm = flm, ll = flt, dm = fdm, dl = fdt;
        }
        for (var i = 0; i < li; ++i) {
          var sym = syms[i];
          if (sym > 255) {
            var len = sym >> 18 & 31;
            wbits16(out, p, lm[len + 257]), p += ll[len + 257];
            if (len > 7)
              wbits(out, p, sym >> 23 & 31), p += fleb[len];
            var dst = sym & 31;
            wbits16(out, p, dm[dst]), p += dl[dst];
            if (dst > 3)
              wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
          } else {
            wbits16(out, p, lm[sym]), p += ll[sym];
          }
        }
        wbits16(out, p, lm[256]);
        return p + ll[256];
      };
      deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
      et = /* @__PURE__ */ new u8(0);
      dflt = function(dat, lvl, plvl, pre, post, st) {
        var s = st.z || dat.length;
        var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
        var w = o.subarray(pre, o.length - post);
        var lst = st.l;
        var pos = (st.r || 0) & 7;
        if (lvl) {
          if (pos)
            w[0] = st.r >> 3;
          var opt = deo[lvl - 1];
          var n = opt >> 13, c = opt & 8191;
          var msk_1 = (1 << plvl) - 1;
          var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
          var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
          var hsh = function(i2) {
            return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
          };
          var syms = new i32(25e3);
          var lf = new u16(288), df = new u16(32);
          var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
          for (; i + 2 < s; ++i) {
            var hv = hsh(i);
            var imod = i & 32767, pimod = head[hv];
            prev[imod] = pimod;
            head[hv] = imod;
            if (wi <= i) {
              var rem = s - i;
              if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
                pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
                li = lc_1 = eb = 0, bs = i;
                for (var j = 0; j < 286; ++j)
                  lf[j] = 0;
                for (var j = 0; j < 30; ++j)
                  df[j] = 0;
              }
              var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
              if (rem > 2 && hv == hsh(i - dif)) {
                var maxn = Math.min(n, rem) - 1;
                var maxd = Math.min(32767, i);
                var ml = Math.min(258, rem);
                while (dif <= maxd && --ch_1 && imod != pimod) {
                  if (dat[i + l] == dat[i + l - dif]) {
                    var nl = 0;
                    for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                      ;
                    if (nl > l) {
                      l = nl, d = dif;
                      if (nl > maxn)
                        break;
                      var mmd = Math.min(dif, nl - 2);
                      var md = 0;
                      for (var j = 0; j < mmd; ++j) {
                        var ti = i - dif + j & 32767;
                        var pti = prev[ti];
                        var cd = ti - pti & 32767;
                        if (cd > md)
                          md = cd, pimod = ti;
                      }
                    }
                  }
                  imod = pimod, pimod = prev[imod];
                  dif += imod - pimod & 32767;
                }
              }
              if (d) {
                syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
                var lin = revfl[l] & 31, din = revfd[d] & 31;
                eb += fleb[lin] + fdeb[din];
                ++lf[257 + lin];
                ++df[din];
                wi = i + l;
                ++lc_1;
              } else {
                syms[li++] = dat[i];
                ++lf[dat[i]];
              }
            }
          }
          for (i = Math.max(i, wi); i < s; ++i) {
            syms[li++] = dat[i];
            ++lf[dat[i]];
          }
          pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
          if (!lst) {
            st.r = pos & 7 | w[pos / 8 | 0] << 3;
            pos -= 7;
            st.h = head, st.p = prev, st.i = i, st.w = wi;
          }
        } else {
          for (var i = st.w || 0; i < s + lst; i += 65535) {
            var e = i + 65535;
            if (e >= s) {
              w[pos / 8 | 0] = lst;
              e = s;
            }
            pos = wfblk(w, pos + 1, dat.subarray(i, e));
          }
          st.i = s;
        }
        return slc(o, 0, pre + shft(pos) + post);
      };
      adler = function() {
        var a = 1, b = 0;
        return {
          p: function(d) {
            var n = a, m = b;
            var l = d.length | 0;
            for (var i = 0; i != l; ) {
              var e = Math.min(i + 2655, l);
              for (; i < e; ++i)
                m += n += d[i];
              n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);
            }
            a = n, b = m;
          },
          d: function() {
            a %= 65521, b %= 65521;
            return (a & 255) << 24 | (a & 65280) << 8 | (b & 255) << 8 | b >> 8;
          }
        };
      };
      dopt = function(dat, opt, pre, post, st) {
        if (!st) {
          st = { l: 1 };
          if (opt.dictionary) {
            var dict = opt.dictionary.subarray(-32768);
            var newDat = new u8(dict.length + dat.length);
            newDat.set(dict);
            newDat.set(dat, dict.length);
            dat = newDat;
            st.w = dict.length;
          }
        }
        return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
      };
      wbytes = function(d, b, v) {
        for (; v; ++b)
          d[b] = v, v >>>= 8;
      };
      zlh = function(c, o) {
        var lv = o.level, fl2 = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
        c[0] = 120, c[1] = fl2 << 6 | (o.dictionary && 32);
        c[1] |= 31 - (c[0] << 8 | c[1]) % 31;
        if (o.dictionary) {
          var h = adler();
          h.p(o.dictionary);
          wbytes(c, 2, h.d());
        }
      };
      zls = function(d, dict) {
        if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31)
          err(6, "invalid zlib data");
        if ((d[1] >> 5 & 1) == +!dict)
          err(6, "invalid zlib data: " + (d[1] & 32 ? "need" : "unexpected") + " dictionary");
        return (d[1] >> 3 & 4) + 2;
      };
      td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
      tds = 0;
      try {
        td.decode(et, { stream: true });
        tds = 1;
      } catch (e) {
      }
    }
  });

  // shims/zlib.js
  var zlib_exports = {};
  __export(zlib_exports, {
    default: () => zlib_default,
    deflateRawSync: () => deflateRawSync,
    deflateSync: () => deflateSync2,
    inflateRawSync: () => inflateRawSync,
    inflateSync: () => inflateSync2
  });
  function cap(out, opts) {
    if (opts && opts.maxOutputLength && out.length > opts.maxOutputLength) throw new Error("\uB108\uBB34 \uD07D\uB2C8\uB2E4");
    return import_buffer3.Buffer.from(out);
  }
  function inflateRawSync(buf, opts) {
    return cap(inflateSync(u82(buf)), opts);
  }
  function deflateRawSync(buf, opts) {
    return import_buffer3.Buffer.from(deflateSync(u82(buf), { level: opts && opts.level != null ? opts.level : 6 }));
  }
  function inflateSync2(buf, opts) {
    return cap(unzlibSync(u82(buf)), opts);
  }
  function deflateSync2(buf, opts) {
    return import_buffer3.Buffer.from(zlibSync(u82(buf), { level: opts && opts.level != null ? opts.level : 6 }));
  }
  var import_buffer3, u82, zlib_default;
  var init_zlib = __esm({
    "shims/zlib.js"() {
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      init_browser();
      import_buffer3 = __toESM(require_buffer());
      u82 = (buf) => new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
      zlib_default = { inflateRawSync, deflateRawSync, inflateSync: inflateSync2, deflateSync: deflateSync2 };
    }
  });

  // ../../개인정보지우개/lib/peek.js
  var require_peek = __commonJS({
    "../../\uAC1C\uC778\uC815\uBCF4\uC9C0\uC6B0\uAC1C/lib/peek.js"(exports, module) {
      "use strict";
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      var fs = (init_fs(), __toCommonJS(fs_exports));
      var zlib = (init_zlib(), __toCommonJS(zlib_exports));
      var MAX_CHARS = 2e6;
      var MAX_FILE = 60 * 1024 * 1024;
      var MAX_INFLATE = 64 * 1024 * 1024;
      var eucKr = null;
      var eucKrTried = false;
      function decodeEucKr(buf) {
        if (!eucKrTried) {
          eucKrTried = true;
          try {
            eucKr = new TextDecoder("euc-kr");
          } catch (_) {
            eucKr = null;
          }
        }
        return eucKr ? eucKr.decode(buf) : "";
      }
      function decode(buf) {
        if (!buf || !buf.length) return "";
        if (buf.length >= 2 && buf[0] === 255 && buf[1] === 254) return buf.toString("utf16le", 2);
        if (buf.length >= 2 && buf[0] === 254 && buf[1] === 255) {
          const body = buf.subarray(2);
          const even = body.length % 2 ? body.subarray(0, body.length - 1) : body;
          const swapped = import_buffer.Buffer.from(even);
          swapped.swap16();
          return swapped.toString("utf16le");
        }
        if (buf.length >= 3 && buf[0] === 239 && buf[1] === 187 && buf[2] === 191) return buf.toString("utf8", 3);
        const utf8 = buf.toString("utf8");
        const bad = (utf8.match(/�/g) || []).length;
        if (bad === 0) return utf8;
        const legacy = decodeEucKr(buf);
        if (!legacy) return utf8;
        const legacyBad = (legacy.match(/�/g) || []).length;
        return legacyBad < bad ? legacy : utf8;
      }
      var ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
      function stripXml(s) {
        return s.replace(/<\/(?:w:p|w:tab|a:p|text:p|hp:p|hp:linebreak)>/gi, " \n").replace(/<[^>]*>/g, " ").replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10))).replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] || " ").replace(/[ \t\r\f\v]+/g, " ").replace(/\n{2,}/g, "\n");
      }
      function safeChar(code) {
        return Number.isFinite(code) && code > 0 && code <= 1114111 ? String.fromCodePoint(code) : " ";
      }
      function readUpTo(file, bytes) {
        const fd2 = fs.openSync(file, "r");
        try {
          const size = fs.fstatSync(fd2).size;
          const len = Math.min(size, bytes);
          const buf = import_buffer.Buffer.alloc(len);
          fs.readSync(fd2, buf, 0, len, 0);
          return buf;
        } finally {
          try {
            fs.closeSync(fd2);
          } catch (_) {
          }
        }
      }
      function readZip(file, want, maxEntries = 12) {
        const out = [];
        let fd2;
        try {
          fd2 = fs.openSync(file, "r");
        } catch (_) {
          return out;
        }
        try {
          const size = fs.fstatSync(fd2).size;
          if (size < 22) return out;
          const tailLen = Math.min(size, 66e3);
          const tail = import_buffer.Buffer.alloc(tailLen);
          fs.readSync(fd2, tail, 0, tailLen, size - tailLen);
          let eocd = -1;
          for (let i = tail.length - 22; i >= 0; i--) {
            if (tail.readUInt32LE(i) === 101010256) {
              eocd = i;
              break;
            }
          }
          if (eocd < 0) return out;
          const count = tail.readUInt16LE(eocd + 10);
          const cdSize = tail.readUInt32LE(eocd + 12);
          const cdOff = tail.readUInt32LE(eocd + 16);
          if (cdOff === 4294967295 || cdSize === 4294967295 || cdSize > 8 * 1024 * 1024) return out;
          if (cdOff + cdSize > size) return out;
          const cd = import_buffer.Buffer.alloc(cdSize);
          fs.readSync(fd2, cd, 0, cdSize, cdOff);
          let p = 0;
          for (let i = 0; i < count && p + 46 <= cd.length; i++) {
            if (cd.readUInt32LE(p) !== 33639248) break;
            const method = cd.readUInt16LE(p + 10);
            const compSize = cd.readUInt32LE(p + 20);
            const nameLen = cd.readUInt16LE(p + 28);
            const extraLen = cd.readUInt16LE(p + 30);
            const commentLen = cd.readUInt16LE(p + 32);
            const localOff = cd.readUInt32LE(p + 42);
            const name = cd.toString("utf8", p + 46, p + 46 + nameLen);
            p += 46 + nameLen + extraLen + commentLen;
            if (!want(name)) continue;
            if (compSize === 0 || compSize > MAX_INFLATE) continue;
            if (localOff + 30 > size) continue;
            const lh = import_buffer.Buffer.alloc(30);
            fs.readSync(fd2, lh, 0, 30, localOff);
            if (lh.readUInt32LE(0) !== 67324752) continue;
            const dataAt = localOff + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
            if (dataAt + compSize > size) continue;
            const raw = import_buffer.Buffer.alloc(compSize);
            fs.readSync(fd2, raw, 0, compSize, dataAt);
            let data = null;
            if (method === 0) data = raw;
            else if (method === 8) {
              try {
                data = zlib.inflateRawSync(raw, { maxOutputLength: MAX_INFLATE });
              } catch (_) {
                data = null;
              }
            }
            if (!data) continue;
            out.push({ name, data });
            if (out.length >= maxEntries) break;
          }
        } catch (_) {
        } finally {
          try {
            fs.closeSync(fd2);
          } catch (_) {
          }
        }
        return out;
      }
      var CFB_SIG = "d0cf11e0a1b11ae1";
      var FREE = 4294967295;
      var END = 4294967294;
      function cfbStream(file, wantName) {
        let fd2;
        try {
          fd2 = fs.openSync(file, "r");
        } catch (_) {
          return null;
        }
        try {
          const size = fs.fstatSync(fd2).size;
          if (size < 1536) return null;
          const hdr = import_buffer.Buffer.alloc(512);
          fs.readSync(fd2, hdr, 0, 512, 0);
          if (hdr.toString("hex", 0, 8) !== CFB_SIG) return null;
          const secSize = 1 << hdr.readUInt16LE(30);
          const miniSize = 1 << hdr.readUInt16LE(32);
          if (secSize < 128 || secSize > 65536 || miniSize < 16) return null;
          const numFat = hdr.readUInt32LE(44);
          const dirStart = hdr.readUInt32LE(48);
          const cutoff = hdr.readUInt32LE(56) || 4096;
          const miniFatStart = hdr.readUInt32LE(60);
          let difat = hdr.readUInt32LE(68);
          const sector = (id) => {
            const off = (id + 1) * secSize;
            if (id > 4294967280 || off + secSize > size) return null;
            const b = import_buffer.Buffer.alloc(secSize);
            fs.readSync(fd2, b, 0, secSize, off);
            return b;
          };
          const fatSectors = [];
          for (let i = 0; i < 109 && fatSectors.length < numFat; i++) {
            const s = hdr.readUInt32LE(76 + i * 4);
            if (s === FREE || s === END) break;
            fatSectors.push(s);
          }
          let guard = 0;
          while (difat !== FREE && difat !== END && fatSectors.length < numFat && guard++ < 512) {
            const b = sector(difat);
            if (!b) break;
            const per = secSize / 4 - 1;
            for (let i = 0; i < per && fatSectors.length < numFat; i++) {
              const s = b.readUInt32LE(i * 4);
              if (s !== FREE && s !== END) fatSectors.push(s);
            }
            difat = b.readUInt32LE(secSize - 4);
          }
          const fat = [];
          for (const fsec of fatSectors) {
            const b = sector(fsec);
            if (!b) break;
            for (let i = 0; i < secSize / 4; i++) fat.push(b.readUInt32LE(i * 4));
          }
          if (!fat.length) return null;
          const chain = (start, max2 = 65536) => {
            const list = [];
            let c2 = start, g2 = 0;
            while (c2 !== END && c2 !== FREE && c2 < fat.length && g2++ < max2) {
              list.push(c2);
              c2 = fat[c2];
            }
            return list;
          };
          const readChain = (start, bytes) => {
            const parts2 = [];
            let got2 = 0;
            for (const s of chain(start)) {
              const b = sector(s);
              if (!b) break;
              parts2.push(b);
              got2 += secSize;
              if (bytes && got2 >= bytes) break;
              if (got2 > MAX_INFLATE) break;
            }
            const all = import_buffer.Buffer.concat(parts2);
            return bytes && bytes < all.length ? all.subarray(0, bytes) : all;
          };
          const dir = readChain(dirStart);
          let root = null, target = null;
          for (let p = 0; p + 128 <= dir.length; p += 128) {
            const nameLen = dir.readUInt16LE(p + 64);
            const type = dir[p + 66];
            if (!nameLen || nameLen > 64 || type !== 2 && type !== 5) continue;
            const name = dir.toString("utf16le", p, p + nameLen - 2).replace(/\0+$/, "");
            const entry = {
              name,
              start: dir.readUInt32LE(p + 116),
              size: Number(dir.readBigUInt64LE(p + 120))
            };
            if (type === 5) root = entry;
            else if (name === wantName) target = entry;
          }
          if (!target || !target.size) return null;
          if (target.size > MAX_INFLATE) target.size = MAX_INFLATE;
          if (target.size >= cutoff) return readChain(target.start, target.size);
          if (!root) return null;
          const miniStream = readChain(root.start, Math.min(root.size || MAX_INFLATE, MAX_INFLATE));
          const miniFatBuf = readChain(miniFatStart);
          const miniFat = [];
          for (let i = 0; i + 4 <= miniFatBuf.length; i += 4) miniFat.push(miniFatBuf.readUInt32LE(i));
          const parts = [];
          let c = target.start, g = 0, got = 0;
          while (c !== END && c !== FREE && c < miniFat.length && g++ < 2e4 && got < target.size) {
            const off = c * miniSize;
            if (off + miniSize > miniStream.length) break;
            parts.push(miniStream.subarray(off, off + miniSize));
            got += miniSize;
            c = miniFat[c];
          }
          return parts.length ? import_buffer.Buffer.concat(parts).subarray(0, target.size) : null;
        } catch (_) {
          return null;
        } finally {
          try {
            fs.closeSync(fd2);
          } catch (_) {
          }
        }
      }
      function unescapePdf(s) {
        return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (m, g) => {
          if (g === "n") return " ";
          if (g === "r") return " ";
          if (g === "t") return " ";
          if (g === "b" || g === "f") return " ";
          if (g === "(" || g === ")" || g === "\\") return g;
          const code = parseInt(g, 8);
          return code >= 32 && code < 127 ? String.fromCharCode(code) : " ";
        });
      }
      function pdfOps(text) {
        let out = "";
        const re = /\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>/g;
        let m;
        while ((m = re.exec(text)) !== null && out.length < MAX_CHARS * 2) {
          const tok = m[0];
          if (tok[0] === "(") {
            out += unescapePdf(tok.slice(1, -1)) + " ";
          } else {
            const hex = tok.slice(1, -1).replace(/\s+/g, "");
            if (hex.length < 4 || hex.length % 4 !== 0) continue;
            const buf = import_buffer.Buffer.from(hex, "hex");
            buf.swap16();
            const s = buf.toString("utf16le");
            if (/[가-힣a-zA-Z]/.test(s)) out += s + " ";
          }
        }
        return out;
      }
      function pdfLooksReadable(s) {
        const hangul = (s.match(/[가-힣]/g) || []).length;
        if (hangul >= 6) return true;
        const clean = s.replace(/\s+/g, "");
        if (clean.length < 40) return false;
        const plain = (clean.match(/[A-Za-z0-9.,;:'"()\-]/g) || []).length;
        return plain / clean.length >= 0.9;
      }
      function pdfText(file) {
        const buf = readUpTo(file, 6 * 1024 * 1024);
        let out = "";
        let i = 0;
        const needle = import_buffer.Buffer.from("stream");
        const endNeedle = import_buffer.Buffer.from("endstream");
        while (out.length < MAX_CHARS) {
          i = buf.indexOf(needle, i);
          if (i === -1) break;
          let s = i + needle.length;
          if (buf[s] === 13) s++;
          if (buf[s] === 10) s++;
          const e = buf.indexOf(endNeedle, s);
          i = e === -1 ? buf.length : e + endNeedle.length;
          if (e === -1) break;
          const chunk = buf.subarray(s, e);
          if (chunk.length < 16 || chunk.length > 3 * 1024 * 1024) continue;
          let data = null;
          if (chunk[0] === 120) {
            try {
              data = zlib.inflateSync(chunk, { maxOutputLength: MAX_INFLATE });
            } catch (_) {
              data = null;
            }
          }
          if (!data) {
            const head = chunk.toString("latin1", 0, Math.min(600, chunk.length));
            if (/\bBT\b|\bTj\b|\bTJ\b/.test(head)) data = chunk;
          }
          if (!data) continue;
          const asText = data.toString("latin1");
          if (!/\bTj\b|\bTJ\b/.test(asText)) continue;
          out += pdfOps(asText);
        }
        out = out.replace(/[ \t]+/g, " ").trim();
        return pdfLooksReadable(out) ? out : "";
      }
      var PLAIN = /* @__PURE__ */ new Set(["txt", "md", "csv", "tsv", "log", "json", "xml", "html", "htm", "rtf"]);
      var ZIP_WANT = {
        hwpx: (n) => n === "Preview/PrvText.txt" || /^Contents\/section\d*\.xml$/i.test(n),
        docx: (n) => n === "word/document.xml" || n === "docProps/core.xml",
        pptx: (n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n) || n === "docProps/core.xml",
        xlsx: (n) => n === "xl/sharedStrings.xml" || n === "docProps/core.xml",
        odt: (n) => n === "content.xml" || n === "meta.xml",
        odp: (n) => n === "content.xml" || n === "meta.xml",
        ods: (n) => n === "content.xml" || n === "meta.xml",
        hwt: (n) => n === "Preview/PrvText.txt" || /^Contents\/section\d*\.xml$/i.test(n)
      };
      function peek2(file, ext) {
        try {
          const st = fs.statSync(file);
          if (!st.isFile() || st.size === 0 || st.size > MAX_FILE) return "";
        } catch (_) {
          return "";
        }
        try {
          if (PLAIN.has(ext)) {
            let text = decode(readUpTo(file, 256 * 1024));
            if (ext === "rtf" || ext === "html" || ext === "htm" || ext === "xml") text = stripXml(text.replace(/\\'[0-9a-f]{2}/gi, " "));
            return text.slice(0, MAX_CHARS);
          }
          if (ZIP_WANT[ext]) {
            const parts = readZip(file, ZIP_WANT[ext], ext === "pptx" ? 11 : 6);
            if (!parts.length) return "";
            parts.sort((a, b) => a.name.localeCompare(b.name, "en"));
            let text = "";
            for (const p of parts) {
              const raw = decode(p.data);
              text += (p.name.endsWith(".txt") ? raw : stripXml(raw)) + "\n";
              if (text.length > MAX_CHARS) break;
            }
            return text.slice(0, MAX_CHARS);
          }
          if (ext === "hwp") {
            const prv = cfbStream(file, "PrvText");
            if (prv && prv.length) {
              const text = prv.toString("utf16le").replace(/\0/g, " ");
              if (/[가-힣a-zA-Z0-9]/.test(text)) return text.replace(/[ \t]+/g, " ").slice(0, MAX_CHARS);
            }
            return "";
          }
          if (ext === "pdf") return pdfText(file).slice(0, MAX_CHARS);
        } catch (_) {
        }
        return "";
      }
      function canPeek(ext) {
        return PLAIN.has(ext) || !!ZIP_WANT[ext] || ext === "hwp" || ext === "pdf";
      }
      module.exports = { peek: peek2, canPeek, decode, stripXml, readZip, cfbStream, ZIP_WANT, PLAIN, get MAX_CHARS() {
        return MAX_CHARS;
      } };
    }
  });

  // ../../개인정보지우개/lib/zipedit.js
  var require_zipedit = __commonJS({
    "../../\uAC1C\uC778\uC815\uBCF4\uC9C0\uC6B0\uAC1C/lib/zipedit.js"(exports, module) {
      "use strict";
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      var fs = (init_fs(), __toCommonJS(fs_exports));
      var zlib = (init_zlib(), __toCommonJS(zlib_exports));
      var MAX_ZIP = 200 * 1024 * 1024;
      var MAX_ENTRY = 64 * 1024 * 1024;
      var CRC_TABLE = (() => {
        const t = new Int32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
          t[n] = c;
        }
        return t;
      })();
      function crc32(buf) {
        let c = -1;
        for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ c >>> 8;
        return ~c >>> 0;
      }
      function readAll(file) {
        let buf;
        try {
          const st = fs.statSync(file);
          if (st.size > MAX_ZIP) return { ok: false, reason: "\uD30C\uC77C\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4" };
          buf = fs.readFileSync(file);
        } catch (e) {
          return { ok: false, reason: "\uD30C\uC77C\uC744 \uC5F4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" };
        }
        if (buf.length < 22) return { ok: false, reason: "zip \uC774 \uC544\uB2D9\uB2C8\uB2E4" };
        let eocd = -1;
        const from = Math.max(0, buf.length - 66e3);
        for (let i = buf.length - 22; i >= from; i--) {
          if (buf.readUInt32LE(i) === 101010256) {
            eocd = i;
            break;
          }
        }
        if (eocd < 0) return { ok: false, reason: "zip \uB05D \uD45C\uC2DC\uB97C \uBABB \uCC3E\uC558\uC2B5\uB2C8\uB2E4" };
        const count = buf.readUInt16LE(eocd + 10);
        const cdSize = buf.readUInt32LE(eocd + 12);
        const cdOff = buf.readUInt32LE(eocd + 16);
        if (cdOff === 4294967295 || cdSize === 4294967295 || count === 65535) {
          return { ok: false, reason: "ZIP64 \uD615\uC2DD\uC740 \uC190\uB300\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" };
        }
        if (cdOff + cdSize > buf.length) return { ok: false, reason: "zip \uBAA9\uCC28\uAC00 \uAE68\uC84C\uC2B5\uB2C8\uB2E4" };
        const entries = [];
        let p = cdOff;
        for (let i = 0; i < count; i++) {
          if (p + 46 > buf.length || buf.readUInt32LE(p) !== 33639248) return { ok: false, reason: "zip \uBAA9\uCC28\uAC00 \uAE68\uC84C\uC2B5\uB2C8\uB2E4" };
          const flags = buf.readUInt16LE(p + 8);
          const method = buf.readUInt16LE(p + 10);
          const time = buf.readUInt16LE(p + 12);
          const date = buf.readUInt16LE(p + 14);
          const crc = buf.readUInt32LE(p + 16);
          const compSize = buf.readUInt32LE(p + 20);
          const size = buf.readUInt32LE(p + 24);
          const nameLen = buf.readUInt16LE(p + 28);
          const extraLen = buf.readUInt16LE(p + 30);
          const commentLen = buf.readUInt16LE(p + 32);
          const localOff = buf.readUInt32LE(p + 42);
          const nameBuf = buf.subarray(p + 46, p + 46 + nameLen);
          p += 46 + nameLen + extraLen + commentLen;
          if (flags & 1) return { ok: false, reason: "\uC554\uD638\uAC00 \uAC78\uB9B0 \uD30C\uC77C\uC740 \uC190\uB300\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" };
          if (compSize > MAX_ENTRY || size > MAX_ENTRY) return { ok: false, reason: "\uC548\uC5D0 \uB108\uBB34 \uD070 \uD56D\uBAA9\uC774 \uC788\uC2B5\uB2C8\uB2E4" };
          if (localOff + 30 > buf.length) return { ok: false, reason: "zip \uC774 \uAE68\uC84C\uC2B5\uB2C8\uB2E4" };
          const lh = localOff;
          if (buf.readUInt32LE(lh) !== 67324752) return { ok: false, reason: "zip \uC774 \uAE68\uC84C\uC2B5\uB2C8\uB2E4" };
          const dataAt = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28);
          if (dataAt + compSize > buf.length) return { ok: false, reason: "zip \uC774 \uAE68\uC84C\uC2B5\uB2C8\uB2E4" };
          entries.push({
            name: nameBuf.toString("utf8"),
            nameBuf,
            method,
            flags,
            time,
            date,
            crc,
            compSize,
            size,
            raw: buf.subarray(dataAt, dataAt + compSize)
          });
        }
        return { ok: true, entries };
      }
      function inflateEntry(entry) {
        if (entry.method === 0) return entry.raw;
        if (entry.method === 8) {
          try {
            return zlib.inflateRawSync(entry.raw, { maxOutputLength: MAX_ENTRY });
          } catch (_) {
            return null;
          }
        }
        return null;
      }
      function build(entries) {
        const parts = [];
        const central = [];
        let offset = 0;
        for (const e of entries) {
          let method = e.method;
          let crc = e.crc;
          let compSize = e.compSize;
          let size = e.size;
          let payload = e.raw;
          if (e.newData) {
            size = e.newData.length;
            crc = crc32(e.newData);
            if (e.method === 0) {
              method = 0;
              payload = e.newData;
            } else {
              method = 8;
              payload = zlib.deflateRawSync(e.newData, { level: 6 });
            }
            compSize = payload.length;
          }
          let flags = e.flags & ~8;
          if (e.nameBuf.some((b) => b >= 128)) flags |= 2048;
          const lh = import_buffer.Buffer.alloc(30);
          lh.writeUInt32LE(67324752, 0);
          lh.writeUInt16LE(20, 4);
          lh.writeUInt16LE(flags, 6);
          lh.writeUInt16LE(method, 8);
          lh.writeUInt16LE(e.time, 10);
          lh.writeUInt16LE(e.date, 12);
          lh.writeUInt32LE(crc, 14);
          lh.writeUInt32LE(compSize, 18);
          lh.writeUInt32LE(size, 22);
          lh.writeUInt16LE(e.nameBuf.length, 26);
          lh.writeUInt16LE(0, 28);
          parts.push(lh, e.nameBuf, payload);
          const cd = import_buffer.Buffer.alloc(46);
          cd.writeUInt32LE(33639248, 0);
          cd.writeUInt16LE(20, 4);
          cd.writeUInt16LE(20, 6);
          cd.writeUInt16LE(flags, 8);
          cd.writeUInt16LE(method, 10);
          cd.writeUInt16LE(e.time, 12);
          cd.writeUInt16LE(e.date, 14);
          cd.writeUInt32LE(crc, 16);
          cd.writeUInt32LE(compSize, 20);
          cd.writeUInt32LE(size, 24);
          cd.writeUInt16LE(e.nameBuf.length, 28);
          cd.writeUInt16LE(0, 30);
          cd.writeUInt16LE(0, 32);
          cd.writeUInt16LE(0, 34);
          cd.writeUInt16LE(0, 36);
          cd.writeUInt32LE(0, 38);
          cd.writeUInt32LE(offset, 42);
          central.push(cd, e.nameBuf);
          offset += lh.length + e.nameBuf.length + payload.length;
        }
        const cdBuf = import_buffer.Buffer.concat(central);
        const eocd = import_buffer.Buffer.alloc(22);
        eocd.writeUInt32LE(101010256, 0);
        eocd.writeUInt16LE(0, 4);
        eocd.writeUInt16LE(0, 6);
        eocd.writeUInt16LE(entries.length, 8);
        eocd.writeUInt16LE(entries.length, 10);
        eocd.writeUInt32LE(cdBuf.length, 12);
        eocd.writeUInt32LE(offset, 16);
        eocd.writeUInt16LE(0, 20);
        return import_buffer.Buffer.concat([...parts, cdBuf, eocd]);
      }
      var TEXT_TAGS = {
        hwpx: ["hp:t"],
        docx: ["w:t"],
        pptx: ["a:t"],
        xlsx: ["t"],
        // sharedStrings.xml 의 <t>
        odt: ["text:p", "text:span"]
      };
      var XML_ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
      function unxml(s) {
        return s.replace(/&(amp|lt|gt|quot|apos|#x?[0-9a-fA-F]+);/g, (m, e) => {
          if (XML_ENT[e]) return XML_ENT[e];
          const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
          return Number.isFinite(code) ? String.fromCodePoint(code) : m;
        });
      }
      function xmlEscape(s) {
        return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
      }
      function editTextNodes(xml, tags, fn) {
        let changed = 0;
        let out = xml;
        for (const tag of tags) {
          const re = new RegExp(`(<${tag}(?:\\s[^>]*)?>)([\\s\\S]*?)(</${tag}>)`, "g");
          out = out.replace(re, (all, open, inner, close) => {
            if (inner.includes("<")) return all;
            const plain = unxml(inner);
            const fixed = fn(plain);
            if (fixed === plain) return all;
            changed += 1;
            return open + xmlEscape(fixed) + close;
          });
        }
        return { xml: out, changed };
      }
      function textPartsOf(ext) {
        if (ext === "hwpx" || ext === "hwt") return { tags: TEXT_TAGS.hwpx, want: (n) => /^Contents\/section\d*\.xml$/i.test(n) || n === "Preview/PrvText.txt" };
        if (ext === "docx" || ext === "docm") return { tags: TEXT_TAGS.docx, want: (n) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/i.test(n) };
        if (ext === "pptx" || ext === "pptm") return { tags: TEXT_TAGS.pptx, want: (n) => /^ppt\/(slides|notesSlides)\/[a-z]+\d+\.xml$/i.test(n) };
        if (ext === "xlsx" || ext === "xlsm") return { tags: TEXT_TAGS.xlsx, want: (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/i.test(n) };
        if (ext === "odt" || ext === "ods" || ext === "odp") return { tags: TEXT_TAGS.odt, want: (n) => n === "content.xml" };
        return null;
      }
      var EDITABLE = ["hwpx", "hwt", "docx", "docm", "pptx", "pptm", "xlsx", "xlsm", "odt", "ods", "odp"];
      function canEdit(ext) {
        return EDITABLE.includes(String(ext || "").toLowerCase());
      }
      function editDocument(file, ext, fn) {
        const parts = textPartsOf(ext);
        if (!parts) return { ok: false, reason: "\uC774 \uD615\uC2DD\uC740 \uACE0\uCE60 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" };
        const read = readAll(file);
        if (!read.ok) return { ok: false, reason: read.reason };
        let nodes = 0;
        for (const e of read.entries) {
          if (!parts.want(e.name)) continue;
          const data = inflateEntry(e);
          if (!data) return { ok: false, reason: `\uC548\uCABD \uD56D\uBAA9\uC744 \uD480 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (${e.name})` };
          if (e.name.endsWith(".txt")) {
            const text = data.toString("utf8");
            const fixed = fn(text);
            if (fixed !== text) {
              e.newData = import_buffer.Buffer.from(fixed, "utf8");
              nodes += 1;
            }
            continue;
          }
          const xml = data.toString("utf8");
          const r = editTextNodes(xml, parts.tags, fn);
          if (r.changed) {
            e.newData = import_buffer.Buffer.from(r.xml, "utf8");
            nodes += r.changed;
          }
        }
        if (!nodes) return { ok: true, buffer: null, nodes: 0 };
        return { ok: true, buffer: build(read.entries), nodes };
      }
      module.exports = {
        readAll,
        inflateEntry,
        build,
        crc32,
        editTextNodes,
        editDocument,
        textPartsOf,
        canEdit,
        EDITABLE,
        unxml,
        xmlEscape
      };
    }
  });

  // shims/os.js
  var require_os = __commonJS({
    "shims/os.js"(exports, module) {
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      module.exports = { homedir: () => "", tmpdir: () => "", EOL: "\n" };
    }
  });

  // shims/path.js
  var require_path = __commonJS({
    "shims/path.js"(exports, module) {
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      function basename(p, ext) {
        let b = String(p).split(/[\/]/).pop();
        if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length);
        return b;
      }
      function dirname(p) {
        const parts = String(p).split(/[\/]/);
        parts.pop();
        return parts.join("/") || ".";
      }
      function extname(p) {
        const m = /\.[^.\/]*$/.exec(basename(p));
        return m ? m[0] : "";
      }
      function relative(from, to) {
        const f = String(from || "").replace(/\\/g, "/").replace(/\/+$/, "");
        const t = String(to || "").replace(/\\/g, "/");
        if (!f) return t;
        if (t === f) return "";
        return t.startsWith(f + "/") ? t.slice(f.length + 1) : t;
      }
      function join(...a) {
        return a.filter((x) => x !== "" && x != null).join("/").replace(/\/+/g, "/");
      }
      var path = { basename, dirname, extname, join, resolve: join, relative, normalize: String, sep: "/" };
      path.posix = path;
      path.win32 = path;
      module.exports = path;
    }
  });

  // shims/crypto.js
  var require_crypto = __commonJS({
    "shims/crypto.js"(exports, module) {
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      module.exports = {
        randomBytes(n) {
          const b = new Uint8Array(n);
          globalThis.crypto.getRandomValues(b);
          return import_buffer.Buffer.from(b);
        }
      };
    }
  });

  // ../../개인정보지우개/lib/scrub.js
  var require_scrub = __commonJS({
    "../../\uAC1C\uC778\uC815\uBCF4\uC9C0\uC6B0\uAC1C/lib/scrub.js"(exports, module) {
      "use strict";
      init_define_process_argv();
      init_define_process_env();
      init_buffer_global();
      var fs = (init_fs(), __toCommonJS(fs_exports));
      var os = require_os();
      var path = require_path();
      var crypto = require_crypto();
      var peek2 = require_peek();
      var detect2 = require_detect();
      var zipedit2 = require_zipedit();
      var APP_DIR = path.join(define_process_env_default.APPDATA || os.homedir(), "PrivacyScrub");
      var SETTINGS_FILE = path.join(APP_DIR, "settings.json");
      var UNDO_FILE = path.join(APP_DIR, "undo.json");
      var BACKUP_ROOT = path.join(APP_DIR, "backup");
      var MAX_BATCHES = 30;
      var MAX_FILES = 8e3;
      var MAX_HITS_TOTAL = 2e4;
      var DOC_EXTS = {
        hwp: "\uD55C\uAE00",
        hwpx: "\uD55C\uAE00",
        hwt: "\uD55C\uAE00",
        doc: "\uC6CC\uB4DC",
        docx: "\uC6CC\uB4DC",
        docm: "\uC6CC\uB4DC",
        rtf: "\uC6CC\uB4DC",
        odt: "\uC6CC\uB4DC",
        ppt: "\uC2AC\uB77C\uC774\uB4DC",
        pptx: "\uC2AC\uB77C\uC774\uB4DC",
        pptm: "\uC2AC\uB77C\uC774\uB4DC",
        odp: "\uC2AC\uB77C\uC774\uB4DC",
        xls: "\uD45C",
        xlsx: "\uD45C",
        xlsm: "\uD45C",
        ods: "\uD45C",
        csv: "\uD45C",
        pdf: "PDF",
        txt: "\uD14D\uC2A4\uD2B8",
        md: "\uD14D\uC2A4\uD2B8",
        log: "\uD14D\uC2A4\uD2B8",
        json: "\uD14D\uC2A4\uD2B8",
        xml: "\uD14D\uC2A4\uD2B8",
        html: "\uD14D\uC2A4\uD2B8",
        htm: "\uD14D\uC2A4\uD2B8",
        tsv: "\uD14D\uC2A4\uD2B8"
      };
      var PLAIN_EDIT = /* @__PURE__ */ new Set(["txt", "md", "log", "json", "xml", "html", "htm", "csv", "tsv"]);
      var SKIP_DIRS = /* @__PURE__ */ new Set([
        "node_modules",
        ".git",
        "$recycle.bin",
        "system volume information",
        "windows",
        "program files",
        "program files (x86)",
        "appdata",
        "__pycache__",
        ".venv",
        "\uAC1C\uC778\uC815\uBCF4\uACA9\uB9AC"
      ]);
      var DEFAULT_SETTINGS = {
        rules: detect2.defaultOn(),
        recursive: true,
        skipBig: 40,
        // MB — 이보다 큰 파일은 건너뛴다
        showMaybe: true,
        // "의심" 도 표시
        quarantineDir: "",
        // 비우면 훑은 폴더 아래 '개인정보격리'
        lastDir: ""
      };
      function ensureDir(d) {
        fs.mkdirSync(d, { recursive: true });
        return d;
      }
      function readJson(file, fallback) {
        try {
          return JSON.parse(fs.readFileSync(file, "utf8"));
        } catch (_) {
          return fallback;
        }
      }
      function writeJson(file, obj) {
        ensureDir(path.dirname(file));
        const tmp = file + ".tmp";
        fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
        fs.renameSync(tmp, file);
      }
      function loadSettings() {
        const s = { ...DEFAULT_SETTINGS, ...readJson(SETTINGS_FILE, {}) };
        const known = new Set(detect2.RULES.map((r) => r.id));
        s.rules = (Array.isArray(s.rules) ? s.rules : []).filter((id) => known.has(id));
        if (!s.rules.length) s.rules = detect2.defaultOn();
        s.recursive = !!s.recursive;
        s.showMaybe = !!s.showMaybe;
        s.skipBig = Math.max(1, Math.min(500, Number(s.skipBig) || 40));
        return s;
      }
      function saveSettings(s) {
        const out = loadSettingsFrom(s);
        writeJson(SETTINGS_FILE, out);
        return out;
      }
      function loadSettingsFrom(s) {
        const merged = { ...DEFAULT_SETTINGS, ...s };
        const known = new Set(detect2.RULES.map((r) => r.id));
        merged.rules = (Array.isArray(merged.rules) ? merged.rules : []).filter((id) => known.has(id));
        merged.recursive = !!merged.recursive;
        merged.showMaybe = !!merged.showMaybe;
        merged.skipBig = Math.max(1, Math.min(500, Number(merged.skipBig) || 40));
        return merged;
      }
      function extOf(name) {
        const m = /\.([A-Za-z0-9]{1,12})$/.exec(name);
        return m ? m[1].toLowerCase() : "";
      }
      function scan(root, settings) {
        const abs = path.resolve(root);
        const files2 = [];
        let skipped = 0;
        let folders = 0;
        const limit = settings.skipBig * 1024 * 1024;
        const walk = (dir, depth) => {
          if (files2.length >= MAX_FILES) return;
          let entries;
          try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
          } catch (_) {
            return;
          }
          folders++;
          for (const ent of entries) {
            if (files2.length >= MAX_FILES) return;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
              if (!settings.recursive) continue;
              if (ent.name.startsWith(".") || SKIP_DIRS.has(ent.name.toLowerCase())) continue;
              if (depth < 8) walk(full, depth + 1);
              continue;
            }
            if (!ent.isFile() || ent.name.startsWith("~$") || ent.name.startsWith(".")) continue;
            const ext = extOf(ent.name);
            if (!DOC_EXTS[ext]) {
              skipped++;
              continue;
            }
            let st;
            try {
              st = fs.statSync(full);
            } catch (_) {
              continue;
            }
            if (st.size === 0) {
              skipped++;
              continue;
            }
            if (st.size > limit) {
              skipped++;
              continue;
            }
            files2.push({
              path: full,
              name: ent.name,
              ext,
              kind: DOC_EXTS[ext],
              size: st.size,
              mtime: st.mtimeMs,
              dir,
              rel: path.relative(abs, full)
            });
          }
        };
        walk(abs, 0);
        return { files: files2, skipped, folders };
      }
      function editability(ext) {
        if (PLAIN_EDIT.has(ext)) return { can: true, how: "plain" };
        if (zipedit2.canEdit(ext)) return { can: true, how: "zip" };
        if (ext === "hwp") return { can: false, why: "\uC61B \uD55C\uAE00(.hwp)\uC740 \uACE0\uCE60 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 \u2014 \uD55C\uAE00\uC5D0\uC11C .hwpx \uB85C \uC800\uC7A5\uD55C \uB4A4 \uB2E4\uC2DC \uD6D1\uC5B4 \uC8FC\uC138\uC694" };
        if (ext === "pdf") return { can: false, why: "PDF \uB294 \uACE0\uCE60 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 \u2014 \uC6D0\uBCF8 \uBB38\uC11C\uB97C \uACE0\uCCD0 \uB2E4\uC2DC \uB9CC\uB4DC\uC138\uC694" };
        if (ext === "doc" || ext === "ppt" || ext === "xls") return { can: false, why: "\uC61B \uC624\uD53C\uC2A4 \uD615\uC2DD\uC740 \uACE0\uCE60 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 \u2014 docx\xB7pptx\xB7xlsx \uB85C \uC800\uC7A5\uD55C \uB4A4 \uB2E4\uC2DC \uD6D1\uC5B4 \uC8FC\uC138\uC694" };
        return { can: false, why: "\uC774 \uD615\uC2DD\uC740 \uACE0\uCE60 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" };
      }
      function inspect(file, ruleIds) {
        let text = "";
        let error = "";
        try {
          text = peek2.peek(file.path, file.ext) || "";
        } catch (e) {
          error = e && e.message || "\uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4";
        }
        const hits = text ? detect2.findInText(text, ruleIds, { wantMaybe: true }) : [];
        const ed = editability(file.ext);
        return {
          ...file,
          chars: text.length,
          hits,
          sure: hits.filter((h) => h.grade === "sure").length,
          maybe: hits.filter((h) => h.grade === "maybe").length,
          canMask: ed.can,
          why: ed.why || "",
          error: error || (!text ? "\uAE00\uC790\uB97C \uAEBC\uB0B4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4 (\uADF8\uB9BC\uB9CC \uB4E0 \uBB38\uC11C\uC77C \uC218 \uC788\uC2B5\uB2C8\uB2E4)" : "")
        };
      }
      var tick = () => new Promise((r) => setImmediate(r));
      async function inspectAll(files2, ruleIds, onProgress) {
        const out = [];
        let hitCount = 0;
        for (let i = 0; i < files2.length; i++) {
          const r = inspect(files2[i], ruleIds);
          hitCount += r.hits.length;
          if (hitCount > MAX_HITS_TOTAL) {
            r.hits = r.hits.slice(0, 20);
            r.truncated = true;
          }
          out.push(r);
          if (i % 8 === 7) {
            if (onProgress) onProgress(i + 1, files2.length, path.basename(files2[i].path));
            await tick();
          }
        }
        if (onProgress) onProgress(files2.length, files2.length, "");
        return out;
      }
      function maskPlain(file, ruleIds) {
        const buf = fs.readFileSync(file);
        const asUtf8 = buf.toString("utf8");
        const broken = asUtf8.includes("\uFFFD");
        if (!broken) {
          const r2 = detect2.maskText(asUtf8, ruleIds, {});
          if (!r2.changed) return { changed: 0 };
          return { changed: r2.changed, buffer: import_buffer.Buffer.from(r2.text, "utf8") };
        }
        const latin = buf.toString("latin1");
        const r = detect2.maskText(latin, ruleIds, { asciiOnly: true });
        if (!r.changed) return { changed: 0, asciiOnly: true };
        return { changed: r.changed, buffer: import_buffer.Buffer.from(r.text, "latin1"), asciiOnly: true };
      }
      function maskZip(file, ext, ruleIds) {
        let changed = 0;
        const r = zipedit2.editDocument(file, ext, (text) => {
          const m = detect2.maskText(text, ruleIds, {});
          changed += m.changed;
          return m.text;
        });
        if (!r.ok) return { changed: 0, error: r.reason };
        if (!r.buffer) return { changed: 0 };
        return { changed, buffer: r.buffer, nodes: r.nodes };
      }
      function verify(file, ext, beforeChars, ruleIds) {
        let text = "";
        try {
          text = peek2.peek(file, ext) || "";
        } catch (_) {
          text = "";
        }
        if (beforeChars > 20 && text.length === 0) {
          return { ok: false, why: "\uACE0\uCE5C \uB4A4 \uAE00\uC790\uB97C \uAEBC\uB0BC \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (\uBB38\uC11C\uAC00 \uAE68\uC9C4 \uAC83 \uAC19\uC2B5\uB2C8\uB2E4)" };
        }
        if (beforeChars > 200 && text.length < beforeChars * 0.7) {
          return { ok: false, why: `\uB0B4\uC6A9\uC774 \uD06C\uAC8C \uC904\uC5C8\uC2B5\uB2C8\uB2E4 (${beforeChars} \u2192 ${text.length}\uC790)` };
        }
        const left = detect2.findInText(text, ruleIds, { wantMaybe: true }).filter((h) => h.grade === "sure");
        return { ok: true, chars: text.length, left: left.length };
      }
      async function maskFiles(targets, ruleIds, onProgress) {
        const batchId = "b" + Date.now().toString(36);
        const backupDir = path.join(BACKUP_ROOT, batchId);
        const results = [];
        const undoItems = [];
        let done = 0;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          const ext = String(t.ext || extOf(t.path)).toLowerCase();
          const ed = editability(ext);
          if (!ed.can) {
            results.push({ path: t.path, ok: false, message: ed.why });
            continue;
          }
          let made;
          try {
            made = PLAIN_EDIT.has(ext) ? maskPlain(t.path, ruleIds) : maskZip(t.path, ext, ruleIds);
          } catch (e) {
            results.push({ path: t.path, ok: false, message: e && e.message || "\uACE0\uCE58\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4" });
            continue;
          }
          if (made.error) {
            results.push({ path: t.path, ok: false, message: made.error });
            continue;
          }
          if (!made.changed || !made.buffer) {
            results.push({
              path: t.path,
              ok: false,
              changed: 0,
              message: made.asciiOnly ? "\uAC00\uB9B4 \uAC83\uC774 \uC5C6\uC2B5\uB2C8\uB2E4 (\uC774 \uD30C\uC77C\uC740 \uC778\uCF54\uB529 \uB54C\uBB38\uC5D0 \uD55C\uAE00\uC774 \uB4E0 \uADDC\uCE59\uC740 \uAC74\uB108\uB701\uB2C8\uB2E4)" : "\uAC00\uB9B4 \uAC83\uC774 \uC5C6\uC2B5\uB2C8\uB2E4 (\uAE00\uC790\uAC00 \uC5EC\uB7EC \uC870\uAC01\uC73C\uB85C \uB098\uB258\uC5B4 \uC788\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4)"
            });
            continue;
          }
          ensureDir(backupDir);
          const backup = path.join(backupDir, `${String(i).padStart(4, "0")}_${path.basename(t.path)}`);
          try {
            fs.copyFileSync(t.path, backup);
          } catch (e) {
            results.push({ path: t.path, ok: false, message: "\uC6D0\uBCF8\uC744 \uBC31\uC5C5\uD560 \uC218 \uC5C6\uC5B4 \uC190\uB300\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4" });
            continue;
          }
          try {
            fs.writeFileSync(t.path, made.buffer);
          } catch (e) {
            try {
              fs.copyFileSync(backup, t.path);
            } catch (_) {
            }
            results.push({ path: t.path, ok: false, message: "\uD30C\uC77C\uC744 \uC4F8 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4 (\uB2E4\uB978 \uD504\uB85C\uADF8\uB7A8\uC774 \uC5F4\uC5B4 \uB450\uC5C8\uB098\uC694?)" });
            continue;
          }
          const v = verify(t.path, ext, Number(t.chars) || 0, ruleIds);
          if (!v.ok) {
            try {
              fs.copyFileSync(backup, t.path);
            } catch (_) {
            }
            results.push({ path: t.path, ok: false, rolledBack: true, message: v.why + " \u2014 \uC6D0\uBCF8\uC73C\uB85C \uB418\uB3CC\uB838\uC2B5\uB2C8\uB2E4" });
            continue;
          }
          done += 1;
          undoItems.push({ path: t.path, backup });
          results.push({
            path: t.path,
            ok: true,
            changed: made.changed,
            left: v.left,
            message: `${made.changed}\uAD70\uB370\uB97C \uAC00\uB838\uC2B5\uB2C8\uB2E4` + (v.left ? ` (${v.left}\uAD70\uB370\uB294 \uB0A8\uC558\uC2B5\uB2C8\uB2E4 \u2014 \uAE00\uC790\uAC00 \uC870\uAC01\uB098 \uC788\uC2B5\uB2C8\uB2E4)` : ""),
            asciiOnly: !!made.asciiOnly
          });
          if (i % 4 === 3 && onProgress) {
            onProgress(i + 1, targets.length);
            await tick();
          }
        }
        if (onProgress) onProgress(targets.length, targets.length);
        const batch = undoItems.length ? recordBatch({ id: batchId, kind: "mask", dir: backupDir, items: undoItems }) : null;
        return { ok: done > 0, done, batch, results };
      }
      function quarantine(targets, root, settings) {
        const base = settings.quarantineDir || path.join(root, "\uAC1C\uC778\uC815\uBCF4\uACA9\uB9AC");
        const batchId = "q" + Date.now().toString(36);
        const stamp = /* @__PURE__ */ new Date();
        const p2 = (n) => String(n).padStart(2, "0");
        const folder = path.join(base, `${stamp.getFullYear()}-${p2(stamp.getMonth() + 1)}-${p2(stamp.getDate())} ${p2(stamp.getHours())}${p2(stamp.getMinutes())}`);
        const items = [];
        const results = [];
        for (const t of targets) {
          const rel = path.relative(root, t.path);
          const safeRel = rel.startsWith("..") ? path.basename(t.path) : rel;
          const dest = path.join(folder, safeRel);
          try {
            ensureDir(path.dirname(dest));
            let target = dest;
            let n = 2;
            while (fs.existsSync(target)) {
              const e = path.extname(dest);
              target = dest.slice(0, dest.length - e.length) + `_${n}` + e;
              n += 1;
              if (n > 200) throw new Error("\uAC19\uC740 \uC774\uB984\uC774 \uB108\uBB34 \uB9CE\uC2B5\uB2C8\uB2E4");
            }
            fs.renameSync(t.path, target);
            items.push({ path: t.path, movedTo: target });
            results.push({ path: t.path, ok: true, message: "\uACA9\uB9AC\uD588\uC2B5\uB2C8\uB2E4" });
          } catch (e) {
            results.push({ path: t.path, ok: false, message: e && e.message || "\uC62E\uAE30\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4" });
          }
        }
        const batch = items.length ? recordBatch({ id: batchId, kind: "quarantine", dir: folder, items }) : null;
        return { ok: items.length > 0, done: items.length, batch, results, folder };
      }
      function loadUndo() {
        const d = readJson(UNDO_FILE, null);
        return d && Array.isArray(d.batches) ? d : { batches: [] };
      }
      function recordBatch(batch) {
        const data = loadUndo();
        data.batches.unshift({ ...batch, at: Date.now(), count: batch.items.length });
        const dropped = data.batches.slice(MAX_BATCHES);
        data.batches = data.batches.slice(0, MAX_BATCHES);
        for (const d of dropped) {
          if (d.kind === "mask" && d.dir && d.dir.startsWith(BACKUP_ROOT)) {
            try {
              fs.rmSync(d.dir, { recursive: true, force: true });
            } catch (_) {
            }
          }
        }
        writeJson(UNDO_FILE, data);
        return { id: batch.id, kind: batch.kind, count: batch.items.length, dir: batch.dir };
      }
      function batchList() {
        return loadUndo().batches.map((b) => ({
          id: b.id,
          kind: b.kind,
          at: b.at,
          count: b.count,
          dir: b.dir,
          sample: b.items.slice(0, 3).map((i) => path.basename(i.path)),
          ready: b.items.some((i) => fs.existsSync(b.kind === "mask" ? i.backup : i.movedTo))
        }));
      }
      function undo(batchId) {
        const data = loadUndo();
        const idx = data.batches.findIndex((b) => b.id === batchId);
        if (idx < 0) return { ok: false, message: "\uADF8 \uAE30\uB85D\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" };
        const batch = data.batches[idx];
        const restored = [];
        const failed = [];
        for (const item of batch.items) {
          try {
            if (batch.kind === "mask") {
              if (!fs.existsSync(item.backup)) throw new Error("\uBC31\uC5C5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4");
              ensureDir(path.dirname(item.path));
              fs.copyFileSync(item.backup, item.path);
            } else {
              if (!fs.existsSync(item.movedTo)) throw new Error("\uACA9\uB9AC\uB41C \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4");
              ensureDir(path.dirname(item.path));
              if (fs.existsSync(item.path)) throw new Error("\uADF8 \uC790\uB9AC\uC5D0 \uD30C\uC77C\uC774 \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4");
              fs.renameSync(item.movedTo, item.path);
            }
            restored.push(item.path);
          } catch (e) {
            failed.push({ name: path.basename(item.path), message: e && e.message || "\uB418\uB3CC\uB9AC\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4" });
          }
        }
        if (!failed.length) {
          if (batch.kind === "mask" && batch.dir && batch.dir.startsWith(BACKUP_ROOT)) {
            try {
              fs.rmSync(batch.dir, { recursive: true, force: true });
            } catch (_) {
            }
          }
          data.batches.splice(idx, 1);
          writeJson(UNDO_FILE, data);
        }
        return { ok: restored.length > 0, restored: restored.length, failed };
      }
      function clearUndo() {
        const data = loadUndo();
        for (const b of data.batches) {
          if (b.kind === "mask" && b.dir && b.dir.startsWith(BACKUP_ROOT)) {
            try {
              fs.rmSync(b.dir, { recursive: true, force: true });
            } catch (_) {
            }
          }
        }
        writeJson(UNDO_FILE, { batches: [] });
        return { ok: true };
      }
      function csvCell(v) {
        const s = String(v == null ? "" : v);
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }
      function timeText(ms) {
        if (!ms) return "";
        const d = new Date(ms);
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
      }
      function toCsv(results, root) {
        const rows = [["\uD3F4\uB354", "\uD30C\uC77C", "\uC885\uB958", "\uD655\uC2E4/\uC758\uC2EC", "\uCC3E\uC740 \uAC83(\uAC00\uB9B0 \uCC44)", "\uC55E\uB4A4 \uAE00", "\uACE0\uCE60 \uC218 \uC788\uB098"]];
        for (const r of results) {
          for (const h of r.hits) {
            rows.push([
              path.relative(root, r.dir) || ".",
              r.name,
              h.label,
              h.grade === "sure" ? "\uD655\uC2E4" : "\uC758\uC2EC",
              h.masked,
              (h.context.before + "\u3010" + h.masked + "\u3011" + h.context.after).slice(0, 120),
              r.canMask ? "\uC608" : r.why
            ]);
          }
        }
        return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
      }
      module.exports = {
        APP_DIR,
        SETTINGS_FILE,
        UNDO_FILE,
        BACKUP_ROOT,
        DEFAULT_SETTINGS,
        DOC_EXTS,
        PLAIN_EDIT,
        MAX_FILES,
        loadSettings,
        saveSettings,
        readJson,
        writeJson,
        ensureDir,
        scan,
        inspect,
        inspectAll,
        editability,
        maskPlain,
        maskZip,
        maskFiles,
        verify,
        quarantine,
        batchList,
        undo,
        clearUndo,
        loadUndo,
        toCsv,
        timeText,
        extOf
      };
    }
  });

  // entry.js
  var entry_exports = {};
  __export(entry_exports, {
    Buffer: () => import_buffer4.Buffer,
    detect: () => detect,
    peek: () => peek,
    scrub: () => scrub,
    vfs: () => vfs,
    zipedit: () => zipedit
  });
  init_define_process_argv();
  init_define_process_env();
  init_buffer_global();
  init_fs();
  var import_buffer4 = __toESM(require_buffer());
  var detect = require_detect();
  var peek = require_peek();
  var zipedit = require_zipedit();
  var scrub = require_scrub();
  return __toCommonJS(entry_exports);
})();
