!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.blproof=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
/**
 * The buffer module from node.js, for the browser.
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install buffer`
 */

var base64 = _dereq_('base64-js')
var ieee754 = _dereq_('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
   // Detect if browser supports Typed Arrays. Supported browsers are IE 10+,
   // Firefox 4+, Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+.
  if (typeof Uint8Array === 'undefined' || typeof ArrayBuffer === 'undefined')
    return false

  // Does the browser support adding properties to `Uint8Array` instances? If
  // not, then that's the same as no `Uint8Array` support. We need to be able to
  // add all the node Buffer API methods.
  // Relevant Firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var arr = new Uint8Array(0)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // Assume object is an array
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof Uint8Array === 'function' &&
      subject instanceof Uint8Array) {
    // Speed optimization -- use set if we're copying from a Uint8Array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  // copy!
  for (var i = 0; i < end - start; i++)
    target[i + target_start] = this[i + start]
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array === 'function') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment the Uint8Array *instance* (not the class!) with Buffer methods
 */
function augment (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0,
      'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":2,"ieee754":3}],2:[function(_dereq_,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var ZERO   = '0'.charCodeAt(0)
	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	module.exports.toByteArray = b64ToByteArray
	module.exports.fromByteArray = uint8ToBase64
}())

},{}],3:[function(_dereq_,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

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

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],4:[function(_dereq_,module,exports){
var Buffer = _dereq_('buffer').Buffer;
var intSize = 4;
var zeroBuffer = new Buffer(intSize); zeroBuffer.fill(0);
var chrsz = 8;

function toArray(buf, bigEndian) {
  if ((buf.length % intSize) !== 0) {
    var len = buf.length + (intSize - (buf.length % intSize));
    buf = Buffer.concat([buf, zeroBuffer], len);
  }

  var arr = [];
  var fn = bigEndian ? buf.readInt32BE : buf.readInt32LE;
  for (var i = 0; i < buf.length; i += intSize) {
    arr.push(fn.call(buf, i));
  }
  return arr;
}

function toBuffer(arr, size, bigEndian) {
  var buf = new Buffer(size);
  var fn = bigEndian ? buf.writeInt32BE : buf.writeInt32LE;
  for (var i = 0; i < arr.length; i++) {
    fn.call(buf, arr[i], i * 4, true);
  }
  return buf;
}

function hash(buf, fn, hashSize, bigEndian) {
  if (!Buffer.isBuffer(buf)) buf = new Buffer(buf);
  var arr = fn(toArray(buf, bigEndian), buf.length * chrsz);
  return toBuffer(arr, hashSize, bigEndian);
}

module.exports = { hash: hash };

},{"buffer":1}],5:[function(_dereq_,module,exports){
var Buffer = _dereq_('buffer').Buffer
var sha = _dereq_('./sha')
var sha256 = _dereq_('./sha256')
var rng = _dereq_('./rng')
var md5 = _dereq_('./md5')

var algorithms = {
  sha1: sha,
  sha256: sha256,
  md5: md5
}

var blocksize = 64
var zeroBuffer = new Buffer(blocksize); zeroBuffer.fill(0)
function hmac(fn, key, data) {
  if(!Buffer.isBuffer(key)) key = new Buffer(key)
  if(!Buffer.isBuffer(data)) data = new Buffer(data)

  if(key.length > blocksize) {
    key = fn(key)
  } else if(key.length < blocksize) {
    key = Buffer.concat([key, zeroBuffer], blocksize)
  }

  var ipad = new Buffer(blocksize), opad = new Buffer(blocksize)
  for(var i = 0; i < blocksize; i++) {
    ipad[i] = key[i] ^ 0x36
    opad[i] = key[i] ^ 0x5C
  }

  var hash = fn(Buffer.concat([ipad, data]))
  return fn(Buffer.concat([opad, hash]))
}

function hash(alg, key) {
  alg = alg || 'sha1'
  var fn = algorithms[alg]
  var bufs = []
  var length = 0
  if(!fn) error('algorithm:', alg, 'is not yet supported')
  return {
    update: function (data) {
      if(!Buffer.isBuffer(data)) data = new Buffer(data)
        
      bufs.push(data)
      length += data.length
      return this
    },
    digest: function (enc) {
      var buf = Buffer.concat(bufs)
      var r = key ? hmac(fn, key, buf) : fn(buf)
      bufs = null
      return enc ? r.toString(enc) : r
    }
  }
}

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = function (alg) { return hash(alg) }
exports.createHmac = function (alg, key) { return hash(alg, key) }
exports.randomBytes = function(size, callback) {
  if (callback && callback.call) {
    try {
      callback.call(this, undefined, new Buffer(rng(size)))
    } catch (err) { callback(err) }
  } else {
    return new Buffer(rng(size))
  }
}

function each(a, f) {
  for(var i in a)
    f(a[i], i)
}

// the least I can do is make error messages for the rest of the node.js/crypto api.
each(['createCredentials'
, 'createCipher'
, 'createCipheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDiffieHellman'
, 'pbkdf2'], function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})

},{"./md5":6,"./rng":7,"./sha":8,"./sha256":9,"buffer":1}],6:[function(_dereq_,module,exports){
/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

var helpers = _dereq_('./helpers');

/*
 * Perform a simple self-test to see if the VM is working
 */
function md5_vm_test()
{
  return hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
}

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);

}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function md5(buf) {
  return helpers.hash(buf, core_md5, 16);
};

},{"./helpers":4}],7:[function(_dereq_,module,exports){
// Original code adapted from Robert Kieffer.
// details at https://github.com/broofa/node-uuid
(function() {
  var _global = this;

  var mathRNG, whatwgRNG;

  // NOTE: Math.random() does not guarantee "cryptographic quality"
  mathRNG = function(size) {
    var bytes = new Array(size);
    var r;

    for (var i = 0, r; i < size; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return bytes;
  }

  if (_global.crypto && crypto.getRandomValues) {
    whatwgRNG = function(size) {
      var bytes = new Uint8Array(size);
      crypto.getRandomValues(bytes);
      return bytes;
    }
  }

  module.exports = whatwgRNG || mathRNG;

}())

},{}],8:[function(_dereq_,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

var helpers = _dereq_('./helpers');

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function sha1(buf) {
  return helpers.hash(buf, core_sha1, 20, true);
};

},{"./helpers":4}],9:[function(_dereq_,module,exports){

/**
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
 * in FIPS 180-2
 * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 *
 */

var helpers = _dereq_('./helpers');

var safe_add = function(x, y) {
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
};

var S = function(X, n) {
  return (X >>> n) | (X << (32 - n));
};

var R = function(X, n) {
  return (X >>> n);
};

var Ch = function(x, y, z) {
  return ((x & y) ^ ((~x) & z));
};

var Maj = function(x, y, z) {
  return ((x & y) ^ (x & z) ^ (y & z));
};

var Sigma0256 = function(x) {
  return (S(x, 2) ^ S(x, 13) ^ S(x, 22));
};

var Sigma1256 = function(x) {
  return (S(x, 6) ^ S(x, 11) ^ S(x, 25));
};

var Gamma0256 = function(x) {
  return (S(x, 7) ^ S(x, 18) ^ R(x, 3));
};

var Gamma1256 = function(x) {
  return (S(x, 17) ^ S(x, 19) ^ R(x, 10));
};

var core_sha256 = function(m, l) {
  var K = new Array(0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0xFC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x6CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2);
  var HASH = new Array(0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19);
    var W = new Array(64);
    var a, b, c, d, e, f, g, h, i, j;
    var T1, T2;
  /* append padding */
  m[l >> 5] |= 0x80 << (24 - l % 32);
  m[((l + 64 >> 9) << 4) + 15] = l;
  for (var i = 0; i < m.length; i += 16) {
    a = HASH[0]; b = HASH[1]; c = HASH[2]; d = HASH[3]; e = HASH[4]; f = HASH[5]; g = HASH[6]; h = HASH[7];
    for (var j = 0; j < 64; j++) {
      if (j < 16) {
        W[j] = m[j + i];
      } else {
        W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
      }
      T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
      T2 = safe_add(Sigma0256(a), Maj(a, b, c));
      h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2);
    }
    HASH[0] = safe_add(a, HASH[0]); HASH[1] = safe_add(b, HASH[1]); HASH[2] = safe_add(c, HASH[2]); HASH[3] = safe_add(d, HASH[3]);
    HASH[4] = safe_add(e, HASH[4]); HASH[5] = safe_add(f, HASH[5]); HASH[6] = safe_add(g, HASH[6]); HASH[7] = safe_add(h, HASH[7]);
  }
  return HASH;
};

module.exports = function sha256(buf) {
  return helpers.hash(buf, core_sha256, 32, true);
};

},{"./helpers":4}],10:[function(_dereq_,module,exports){
module.exports = _dereq_('./lib/blproof');

},{"./lib/blproof":11}],11:[function(_dereq_,module,exports){
var Tree = _dereq_('./tree'),
  crypto = _dereq_('crypto'),
  helpers = _dereq_('./helpers'),
  Big = _dereq_('big.js');

// monkey patch Big to disable exponent notation when calling toSring
// exponent notation is not allowed by specification
Big.prototype.toString = helpers.bigToString;


function big(val) {
  return (val instanceof Big) ? val : new Big(val);
}

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function nonce () {
  // @TODO: 128 bits of randomness!?
  // Javascript floating numbers are represented with 64 bit IIRC
  // The following code will probably make cryptographers want to tear their
  // eyes out.
  var randomness = Math.random() + '' + Math.random();
  var hex = sha256(randomness);
  // 128 bits can be represented with 32 hex characters
  return hex.substr(0, 32);
}

// http://stackoverflow.com/questions/728360/most-elegant-way-to-clone-a-javascript-object
function clone (obj) {
  if (null === obj || "object" != typeof obj) return obj;
  var copy = obj.constructor();
  for (var attr in obj) {
    if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
  }
  return copy;
}

function combine_nodes (left_node, right_node) {
  var n = {};
  n.sum = big(left_node.sum).plus(right_node.sum);
  n.hash = sha256(n.sum + '' + left_node.hash + '' + right_node.hash);
  return n;
}

function generate_leaf_hash (user, sum, nonce) {
  return sha256(user + '|' + big(sum) + '|' + nonce);
}

// @todo: since all nodes are at same tree level, this might
// leak information about number of users. randomize tree structure!?
// add fake nodes with 0 balance? maybe all right leaf node should be a dummy user?
function generate_complete_tree (accounts) {
  var mode = 'default';

  // first account has nonce set triggers deterministic mode
  if (accounts[0].nonce) {
    mode = 'deterministic';
  }

  // Generate deterministic tree
  if (mode === 'determinisitc') {
    // Pad out accounts to get a power of 2 to get a perfect binary tree
    var next_power_of_2 = 1;
    // Find next power of 2
    while (next_power_of_2 < accounts.length) {
      next_power_of_2 = Math.pow(next_power_of_2, 2);
    }
    while (accounts.length < next_power_of_2) {
      accounts.push({ user: 'dummy', balance: '0', nonce: '0' });
    }
  }

  // Generate initial hash / sum for leaf nodes
  accounts.forEach(function (account) {
    // switch to test mode if the accounts JSON has a nonce set
    if (account.nonce) mode ='test';

    account.user = account.user;
    account.sum = big(account.balance);
    // make it possible to specify nonce in account.json for testing implementations
    account.nonce = '' + (account.nonce || nonce());
    account.hash = generate_leaf_hash(account.user, account.sum, account.nonce);
    delete account.balance;
  });

  // Accounts must be on the leaf nodes of the tree
  // so we need to find out how many interior nodes we should generate.
  //
  // The number of nodes n in a complete binary tree can be found using this formula:
  // n = 2l-1 where l is the number of leaf nodes in the tree.

  var l = accounts.length; // number of leafs
  var n = 2 * l - 1; // number of nodes
  var i = n - l; // number of interior nodes

  // Fill beginning of the array with "interior nodes"
  var arr = (new Array(i)).concat(accounts);

  var tree = Tree.fromArray(arr);

  tree.reverseLevelTraverse(function (node) {
    if (!node.data) {
      node.data = combine_nodes(tree.left(node).data, tree.right(node).data);
    }
  });

  return tree;
}

function extract_partial_tree (complete_tree, user) {
  // shallow!? clone complete tree and remove irrelevant nodes
  var partial_tree = complete_tree.clone();

  var node = partial_tree.reverseLevelSearch(function (node) {
    if (node.data.user === user) {
      return node;
    }
  });

  if (!node) throw new Error('Could not find node with user: ' + user);

  var path = partial_tree.extractPath(node);
  var selected_nodes = path.slice(0);

  // we have the path from the node to the root
  // now we need to make sure the sibling of each node
  // is selected as well
  path.forEach(function (node) {
    var sibling = partial_tree.sibling(node);
    if (sibling) {
      selected_nodes.push(partial_tree.sibling(node));
    }
  });

  // We have now selected all relevant nodes, we can delete
  // the irrelevant nodes
  partial_tree.slice(selected_nodes);

  // Make sure we remove all unnecessary data
  // @see https://github.com/olalonde/blind-liability-proof/issues/12
  partial_tree.traverse(function (n) {
    // every node except user's node
    var minimal_data;
    // user's node
    if (n === node) {
      minimal_data = {
        user: n.data.user,
        sum: n.data.sum,
        nonce: n.data.nonce
      };
    }
    // interior node
    else if (partial_tree.left(n)) {
      minimal_data = null;
    }
    else {
      minimal_data = {
        sum: n.data.sum,
        hash: n.data.hash
      };
    }

    // replace node by a copy
    // so we don't modify the node in other trees.. ugly hack, I know
    partial_tree.insert(minimal_data, n.index);
  });

  return partial_tree;
}

function generate_internal_nodes (tree) {
  tree.reverseLevelTraverse(function (node) {
    var left = tree.left(node);
    var right = tree.right(node);
    // internal nodes
    if (left && right) {
      node.data = combine_nodes(left.data, right.data);
    }
    // leaf nodes
    else if (!node.data.hash) {
      node.data.hash = generate_leaf_hash(node.data.user, node.data.sum, node.data.nonce);
    }
  });
}

function verify_tree (tree, expected_root_data) {
  if (!tree)
    throw new Error('You must provide the partial tree as a first argument.');

  if (!expected_root_data)
    throw new Error('You must provide expected root data hash as a second argument.');

  tree = tree.clone();

  var user_node = tree.reverseLevelSearch(function (node) {
    if (node.data && node.data.user) {
      return node;
    }
  });

  // Verify that there is a user node
  if (!user_node) {
    throw new Error('Could not find any user node!');
  }

  generate_internal_nodes(tree);

  // Verify that root is correct
  var root_data = tree.root().data;

  if (big(root_data.sum).eq(expected_root_data.sum) && root_data.hash === expected_root_data.hash) {
    // root is correct!
  }
  else {
    throw new Error('Root mismatch. Expected ' +
                    JSON.stringify(expected_root_data) +
                    ', got ' + JSON.stringify(root_data));
  }

  // Verify that there are no negative balances
  tree.reverseLevelTraverse(function (node) {
    // There is a negative balance!
    if (node.data.sum < 0) {
      throw new Error('Negative balance detected!');
    }
  });

  return user_node.data;
}

// @TODO: make sure to use big()'s stringification for numbers
// @TODO: maybe refactor all this to have a consistent .serialize method on tree objects / nodes?
function serialize_partial_tree (ptree, id) {
  var obj = {
    id: id,
    partial_tree: ptree.toObjectGraph()
  };
  return JSON.stringify(obj);
}

function deserialize_partial_tree (str) {
  var tree = new Tree();
  var graph = JSON.parse(str).partial_tree;
  tree.fromObjectGraph(graph);
  return tree;
}

function serialize_root (complete_tree, id) {
  var obj = {
    id: id,
    root: complete_tree.root().data
  };
  return JSON.stringify(obj);
}

function deserialize_root (str) {
  return JSON.parse(str).root;
}

module.exports.Tree = Tree;
module.exports.generateCompleteTree = generate_complete_tree;
module.exports.extractPartialTree = extract_partial_tree;
module.exports.serializePartialTree = serialize_partial_tree;
module.exports.deserializePartialTree = deserialize_partial_tree;
module.exports.serializeRoot = serialize_root;
module.exports.deserializeRoot = deserialize_root;
module.exports.verifyTree = verify_tree;

},{"./helpers":12,"./tree":13,"big.js":14,"crypto":5}],12:[function(_dereq_,module,exports){
// slightly modified version of https://github.com/MikeMcl/big.js/blob/master/big.js#L834
module.exports.bigToString = function  () {
  var x = this,
  e = x['e'],
  str = x['c'].join(''),
  strL = str.length;

  // Negative exponent?
  if ( e < 0 ) {
    // Prepend zeros.
    for ( ; ++e; str = '0' + str ) {
    }
    str = '0.' + str;

    // Positive exponent?
  } else if ( e > 0 ) {

    if ( ++e > strL ) {

      // Append zeros.
      for ( e -= strL; e-- ; str += '0' ) {
      }
    } else if ( e < strL ) {
      str = str.slice( 0, e ) + '.' + str.slice(e);
    }

    // Exponent zero.
  } else if ( strL > 1 ) {
    str = str.charAt(0) + '.' + str.slice(1);
  }

  // Avoid '-0'
  return x['s'] < 0 && x['c'][0] ? '-' + str : str;
};

},{}],13:[function(_dereq_,module,exports){
//var util = require('util');

// Simple perfect binary tree implementation

var Node = function (options) {
  this.index = options.index || 0;
  this.data = options.data || null;
  //this.parent = options.parent || null;
  //this.left = null;
  //this.right = null;
};

var Tree = function () {
  this.arr = [];
};

Tree.fromArray = function (arr) {
  var tree = new Tree();
  if (Array.isArray(arr)) {
    for (var i = 0; i < arr.length; i++) {
      tree.insert(arr[i]);
    }
  }
  return tree;
};

Tree.prototype.nodeCount = function () {
  return this.arr.length;
};

Tree.prototype.insert = function (element, index) {
  var node;
  if (typeof index === 'number') {
    node = new Node({
      data: element,
      index: index
    });

    // expand array
    if (index >= this.arr.length) {
      this.arr.concat(new Array(index - this.arr.length + 1));
    }
    this.arr[index] = node;
  }
  else {
    node = new Node({
      data: element,
      index: this.arr.length
    });

    this.arr.push(node);
  }
};

Tree.prototype.root = function () {
  return this.arr[0];
};

Tree.prototype.getDepth = function (node) {
  var n = this.arr.length;
  if (node) {
    n = node.index + 1;
  }

  //http://stackoverflow.com/questions/3019278/any-way-to-specify-the-base-of-math-log-in-javascript
  return Math.ceil((Math.log(n + 1) / Math.log(2) - 1));
};

Tree.prototype.left = function (node) {
  return this.arr[2 * node.index + 1];
};
Tree.prototype.right = function (node) {
  return this.arr[2 * node.index + 2];
};
Tree.prototype.parent = function (node) {
  return this.arr[Math.floor((node.index - 1) / 2)];
};
Tree.prototype.sibling = function (node) {
  if (node.index % 2 === 0) {
    return this.arr[node.index - 1];
  }
  else {
    return this.arr[node.index + 1];
  }
};

function repeat(str, depth) {
  var spacing = '';
  for (var i = 0; i < depth; i++) {
    spacing += str;
  }
  return spacing;
}

Tree.prototype.prettyPrint = function (cb) {
  console.log(this.prettyPrintStr(cb));
};

Tree.prototype.prettyPrintStr = function (cb, node, spacing) {
  if (typeof cb !== 'function') {
    cb = function (node) {
      return JSON.stringify(node.data);
    };
  }
  if (!node) {
    node = this.root();
  }

  spacing = spacing || '';

  var str = '',
    depth = this.getDepth(node);

  spacing += ' ';
  //str += 'depth: ' + this.getDepth(node) + ' ';

  str += cb(node);
  if (this.left(node) || this.left(node)) {
    str += '\n';
    str += spacing + '|_ ';
    str += this.prettyPrintStr(cb, this.left(node), spacing + '|');
  }
  if (this.right(node)) {
    str += '\n';
    str += spacing + '|_ ';
    str += this.prettyPrintStr(cb, this.right(node), spacing + ' ');
  }

  return str;
};

// shallow copy
Tree.prototype.clone = function () {
  var clone = new Tree();
  clone.arr = JSON.parse(JSON.stringify(this.arr));
  return clone;
};

// Traverse depth first starting from root
Tree.prototype.traverse = function (cb, node) {
  node = node || this.root();

  cb(node);

  var left = this.left(node);
  var right = this.right(node);

  if (left) {
    this.traverse(cb, left);
  }
  if (right) {
    this.traverse(cb, right);
  }
};

// Traverse nodes level by level, starting from the bottom
// Stop traversing when a callback returns false
Tree.prototype.reverseLevelTraverse = function (cb) {
  for (var i = this.arr.length - 1; i >= 0; i--) {
    if (!this.arr[i]) continue;
    if (cb(this.arr[i]) === false) {
      return false;
    }
  }
};

Tree.prototype.reverseLevelSearch = function (predicate) {
  for (var i = this.arr.length - 1; i >= 0; i--) {
    if (predicate(this.arr[i])) {
      return this.arr[i];
    }
  }
  return false;
};

// Extract the path of a node from node to end (or root)
// @return array of nodes
Tree.prototype.extractPath = function (start, end) {
  if (!end) end = this.root();

  var node = start;
  var path = [ node ];

  while (node !== end && node !== this.root()) {
    node = this.parent(node);
    path.push(node);
  }

  return path;
};

// deletes every node from tree except the nodes passed as argument
Tree.prototype.slice = function (selected_nodes) {
  var new_arr = new Array(this.arr.length);
  var max_index = 0;
  for (var i = 0; i < selected_nodes.length; i++) {
    var node = selected_nodes[i];
    if (node.index > max_index) max_index = node.index;
    new_arr[node.index] = node;
  }
  // cut out end of array
  new_arr = new_arr.slice(0, max_index + 1);
  this.arr = new_arr;
  return this;
};

// See https://github.com/olalonde/blind-solvency-proof#partial-trees
Tree.prototype.serialize = function (node) {
  var n = this.toObjectGraph();
  //console.log(util.inspect(n, {depth: null}));
  return JSON.stringify(n);
};

Tree.deserialize = function (str) {
  var tree = new Tree();
  // @TODO: browser bug when $.ajax already parses response
  var graph = JSON.parse(str);
  tree.fromObjectGraph(graph);
  return tree;
};

// internally we represent trees as an array, not as an
// object graph so we need to convert
Tree.prototype.fromObjectGraph = function (n, index) {
  index = index || 0;
  this.insert(n.data, index);
  if (n.left) {
    this.fromObjectGraph(n.left, 2 * index + 1);
  }
  if (n.right) {
    this.fromObjectGraph(n.right, 2 * index + 2);
  }
  return this;
};

Tree.prototype.toObjectGraph = function (node) {
  if (!node) node = this.root();
  var n = {};

  if (node.data) {
    n.data = node.data;
  }

  var left = this.left(node);
  var right = this.right(node);

  if (left) {
    n.left = this.toObjectGraph(left);
  }
  if (right) {
    n.right = this.toObjectGraph(right);
  }
  return n;
};

Tree.prototype.serializeToArray = function () {
  return JSON.stringify(this.arr);
};

Tree.deserializeFromArray = function (str) {
  var tree = new Tree();
  tree.arr = JSON.parse(str);
  return tree;
};

module.exports = Tree;

},{}],14:[function(_dereq_,module,exports){
/* big.js v2.5.0 https://github.com/MikeMcl/big.js/LICENCE */
;(function ( global ) {
    'use strict';

    /*
      big.js v2.5.0
      A small, fast, easy-to-use library for arbitrary-precision decimal arithmetic.
      https://github.com/MikeMcl/big.js/
      Copyright (c) 2012 Michael Mclaughlin <M8ch88l@gmail.com>
      MIT Expat Licence
    */

    /****************************** EDITABLE DEFAULTS **********************************/


    // The default values below must be integers within the stated ranges (inclusive).

    /*
     * The maximum number of decimal places of the results of methods involving
     * division, i.e. 'div' and 'sqrt', and 'pow' with negative exponents.
     */
    Big['DP'] = 20;                                  // 0 to MAX_DP

    /*
     * The rounding mode used when rounding to the above decimal places.
     *
     * 0 Round towards zero (i.e. truncate, no rounding).               (ROUND_DOWN)
     * 1 Round to nearest neighbour. If equidistant, round up.          (ROUND_HALF_UP)
     * 2 Round to nearest neighbour. If equidistant, to even neighbour. (ROUND_HALF_EVEN)
     * 3 Round away from zero.                                          (ROUND_UP)
     */
    Big['RM'] = 1;                                   // 0, 1, 2 or 3

        // The maximum value of 'Big.DP'.
    var MAX_DP = 1E6,                                // 0 to 1e+6

        // The maximum magnitude of the exponent argument to the 'pow' method.
        MAX_POWER = 1E6,                             // 1 to 1e+6

        /*
         * The exponent value at and beneath which 'toString' returns exponential notation.
         * Javascript's Number type: -7
         * -1e+6 is the minimum recommended exponent value of a Big.
         */
        TO_EXP_NEG = -7,                             // 0 to -1e+6

        /*
         * The exponent value at and above which 'toString' returns exponential notation.
         * Javascript's Number type: 21
         * 1e+6 is the maximum recommended exponent value of a Big, though there is no
         * enforcing or checking of a limit.
         */
        TO_EXP_POS = 21,                             // 0 to 1e+6


    /***********************************************************************************/

        P = Big.prototype,
        isValid = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
        ONE = new Big(1);


    // CONSTRUCTOR


    /*
     * The exported function.
     * Create and return a new instance of a Big object.
     *
     * n {number|string|Big} A numeric value.
     */
    function Big( n ) {
        var i, j, nL,
            x = this;

        // Enable constructor usage without new.
        if ( !(x instanceof Big) ) {
            return new Big( n )
        }

        // Duplicate.
        if ( n instanceof Big ) {
            x['s'] = n['s'];
            x['e'] = n['e'];
            x['c'] = n['c'].slice();
            return
        }

        // Minus zero?
        if ( n === 0 && 1 / n < 0 ) {
            n = '-0'
        // Ensure 'n' is string and check validity.
        } else if ( !isValid.test(n += '') ) {
            throwErr( NaN )
        }

        // Determine sign.
        x['s'] = n.charAt(0) == '-' ? ( n = n.slice(1), -1 ) : 1;

        // Decimal point?
        if ( ( i = n.indexOf('.') ) > -1 ) {
            n = n.replace( '.', '' )
        }

        // Exponential form?
        if ( ( j = n.search(/e/i) ) > 0 ) {

            // Determine exponent.
            if ( i < 0 ) {
                i = j
            }
            i += +n.slice( j + 1 );
            n = n.substring( 0, j )

        } else if ( i < 0 ) {

            // Integer.
            i = n.length
        }

        // Determine leading zeros.
        for ( j = 0; n.charAt(j) == '0'; j++ ) {
        }

        if ( j == ( nL = n.length ) ) {

            // Zero.
            x['c'] = [ x['e'] = 0 ]
        } else {

            // Determine trailing zeros.
            for ( ; n.charAt(--nL) == '0'; ) {
            }

            x['e'] = i - j - 1;
            x['c'] = [];

            // Convert string to array of digits (without leading and trailing zeros).
            for ( i = 0; j <= nL; x['c'][i++] = +n.charAt(j++) ) {
            }
        }
    }


    // PRIVATE FUNCTIONS


    /*
     * Round Big 'x' to a maximum of 'dp' decimal places using rounding mode
     * 'rm'. (Called by 'div', 'sqrt' and 'round'.)
     *
     * x {Big} The Big to round.
     * dp {number} Integer, 0 to MAX_DP inclusive.
     * rm {number} 0, 1, 2 or 3 ( ROUND_DOWN, ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_UP )
     * [more] {boolean} Whether the result of division was truncated.
     */
    function rnd( x, dp, rm, more ) {
        var xc = x['c'],
            i = x['e'] + dp + 1;

        if ( rm === 1 ) {
            // 'xc[i]' is the digit after the digit that may be rounded up.
            more = xc[i] >= 5
        } else if ( rm === 2 ) {
            more = xc[i] > 5 || xc[i] == 5 && ( more || i < 0 || xc[i + 1] != null || xc[i - 1] & 1 )
        } else if ( rm === 3 ) {
            more = more || xc[i] != null || i < 0
        } else if ( more = false, rm !== 0 ) {
            throwErr( '!Big.RM!' )
        }

        if ( i < 1 || !xc[0] ) {
            x['c'] = more
              // 1, 0.1, 0.01, 0.001, 0.0001 etc.
              ? ( x['e'] = -dp, [1] )
              // Zero.
              : [ x['e'] = 0 ];
        } else {

            // Remove any digits after the required decimal places.
            xc.length = i--;

            // Round up?
            if ( more ) {

                // Rounding up may mean the previous digit has to be rounded up and so on.
                for ( ; ++xc[i] > 9; ) {
                    xc[i] = 0;

                    if ( !i-- ) {
                        ++x['e'];
                        xc.unshift(1)
                    }
                }
            }

            // Remove trailing zeros.
            for ( i = xc.length; !xc[--i]; xc.pop() ) {
            }
        }

        return x
    }


    /*
     * Throw a BigError.
     *
     * message {string} The error message.
     */
    function throwErr( message ) {
        var err = new Error( message );
        err['name'] = 'BigError';

        throw err
    }


    // PROTOTYPE/INSTANCE METHODS


    /*
     * Return a new Big whose value is the absolute value of this Big.
     */
    P['abs'] = function () {
        var x = new Big(this);
        x['s'] = 1;

        return x
    };


    /*
     * Return
     * 1 if the value of this 'Big' is greater than the value of 'Big' 'y',
     * -1 if the value of this 'Big' is less than the value of 'Big' 'y', or
     * 0 if they have the same value.
    */
    P['cmp'] = function ( y ) {
        var xNeg,
            x = this,
            xc = x['c'],
            yc = ( y = new Big( y ) )['c'],
            i = x['s'],
            j = y['s'],
            k = x['e'],
            l = y['e'];

        // Either zero?
        if ( !xc[0] || !yc[0] ) {
            return !xc[0] ? !yc[0] ? 0 : -j : i
        }

        // Signs differ?
        if ( i != j ) {
            return i
        }
        xNeg = i < 0;

        // Compare exponents.
        if ( k != l ) {
            return k > l ^ xNeg ? 1 : -1
        }

        // Compare digit by digit.
        for ( i = -1,
              j = ( k = xc.length ) < ( l = yc.length ) ? k : l;
              ++i < j; ) {

            if ( xc[i] != yc[i] ) {
                return xc[i] > yc[i] ^ xNeg ? 1 : -1
            }
        }

        // Compare lengths.
        return k == l ? 0 : k > l ^ xNeg ? 1 : -1
    };


    /*
     * Return a new Big whose value is the value of this Big divided by the
     * value of Big 'y', rounded, if necessary, to a maximum of 'Big.DP'
     * decimal places using rounding mode 'Big.RM'.
     */
    P['div'] = function ( y ) {
        var x = this,
            dvd = x['c'],
            dvs = ( y = new Big(y) )['c'],
            s = x['s'] == y['s'] ? 1 : -1,
            dp = Big['DP'];

        if ( dp !== ~~dp || dp < 0 || dp > MAX_DP ) {
            throwErr( '!Big.DP!' )
        }

        // Either 0?
        if ( !dvd[0] || !dvs[0] ) {

            // Both 0?
            if ( dvd[0] == dvs[0] ) {
                throwErr( NaN )
            }

            // 'dvs' is 0?
            if ( !dvs[0] ) {
                // Throw +-Infinity.
                throwErr( s / 0 )
            }

            // 'dvd' is 0. Return +-0.
            return new Big( s * 0 )
        }

        var dvsL, dvsT, next, cmp, remI,
            dvsZ = dvs.slice(),
            dvdI = dvsL = dvs.length,
            dvdL = dvd.length,
            rem = dvd.slice( 0, dvsL ),
            remL = rem.length,
            quo = new Big(ONE),
            qc = quo['c'] = [],
            qi = 0,
            digits = dp + ( quo['e'] = x['e'] - y['e'] ) + 1;

        quo['s'] = s;
        s = digits < 0 ? 0 : digits;

        // Create version of divisor with leading zero.
        dvsZ.unshift(0);

        // Add zeros to make remainder as long as divisor.
        for ( ; remL++ < dvsL; rem.push(0) ) {
        }

        do {

            // 'next' is how many times the divisor goes into the current remainder.
            for ( next = 0; next < 10; next++ ) {

                // Compare divisor and remainder.
                if ( dvsL != ( remL = rem.length ) ) {
                    cmp = dvsL > remL ? 1 : -1
                } else {
                    for ( remI = -1, cmp = 0; ++remI < dvsL; ) {

                        if ( dvs[remI] != rem[remI] ) {
                            cmp = dvs[remI] > rem[remI] ? 1 : -1;
                            break
                        }
                    }
                }

                // Subtract divisor from remainder (if divisor < remainder).
                if ( cmp < 0 ) {

                    // Remainder cannot be more than one digit longer than divisor.
                    // Equalise lengths using divisor with extra leading zero?
                    for ( dvsT = remL == dvsL ? dvs : dvsZ; remL; ) {

                        if ( rem[--remL] < dvsT[remL] ) {

                            for ( remI = remL;
                                  remI && !rem[--remI];
                                  rem[remI] = 9 ) {
                            }
                            --rem[remI];
                            rem[remL] += 10
                        }
                        rem[remL] -= dvsT[remL]
                    }
                    for ( ; !rem[0]; rem.shift() ) {
                    }
                } else {
                    break
                }
            }

            // Add the 'next' digit to the result array.
            qc[qi++] = cmp ? next : ++next;

            // Update the remainder.
            rem[0] && cmp
              ? ( rem[remL] = dvd[dvdI] || 0 )
              : ( rem = [ dvd[dvdI] ] )

        } while ( ( dvdI++ < dvdL || rem[0] != null ) && s-- );

        // Leading zero? Do not remove if result is simply zero (qi == 1).
        if ( !qc[0] && qi != 1) {

            // There can't be more than one zero.
            qc.shift();
            quo['e']--;
        }

        // Round?
        if ( qi > digits ) {
            rnd( quo, dp, Big['RM'], rem[0] != null )
        }

        return quo
    }


    /*
     * Return true if the value of this Big is equal to the value of Big 'y',
     * otherwise returns false.
     */
    P['eq'] = function ( y ) {
        return !this.cmp( y )
    };


    /*
     * Return true if the value of this Big is greater than the value of Big 'y',
     * otherwise returns false.
     */
    P['gt'] = function ( y ) {
        return this.cmp( y ) > 0
    };


    /*
     * Return true if the value of this Big is greater than or equal to the
     * value of Big 'y', otherwise returns false.
     */
    P['gte'] = function ( y ) {
        return this.cmp( y ) > -1
    };


    /*
     * Return true if the value of this Big is less than the value of Big 'y',
     * otherwise returns false.
     */
    P['lt'] = function ( y ) {
        return this.cmp( y ) < 0
    };


    /*
     * Return true if the value of this Big is less than or equal to the value
     * of Big 'y', otherwise returns false.
     */
    P['lte'] = function ( y ) {
         return this.cmp( y ) < 1
    };


    /*
     * Return a new Big whose value is the value of this Big minus the value
     * of Big 'y'.
     */
    P['minus'] = function ( y ) {
        var d, i, j, xLTy,
            x = this,
            a = x['s'],
            b = ( y = new Big( y ) )['s'];

        // Signs differ?
        if ( a != b ) {
            return y['s'] = -b, x['plus'](y)
        }

        var xc = x['c'].slice(),
            xe = x['e'],
            yc = y['c'],
            ye = y['e'];

        // Either zero?
        if ( !xc[0] || !yc[0] ) {

            // 'y' is non-zero?
            return yc[0]
              ? ( y['s'] = -b, y )
              // 'x' is non-zero?
              : new Big( xc[0]
                ? x
                // Both are zero.
                : 0 )
        }

        // Determine which is the bigger number.
        // Prepend zeros to equalise exponents.
        if ( a = xe - ye ) {
            d = ( xLTy = a < 0 ) ? ( a = -a, xc ) : ( ye = xe, yc );

            for ( d.reverse(), b = a; b--; d.push(0) ) {
            }
            d.reverse()
        } else {

            // Exponents equal. Check digit by digit.
            j = ( ( xLTy = xc.length < yc.length ) ? xc : yc ).length;

            for ( a = b = 0; b < j; b++ ) {

                if ( xc[b] != yc[b] ) {
                    xLTy = xc[b] < yc[b];
                    break
                }
            }
        }

        // 'x' < 'y'? Point 'xc' to the array of the bigger number.
        if ( xLTy ) {
            d = xc, xc = yc, yc = d;
            y['s'] = -y['s']
        }

        /*
         * Append zeros to 'xc' if shorter. No need to add zeros to 'yc' if shorter
         * as subtraction only needs to start at 'yc.length'.
         */
        if ( ( b = -( ( j = xc.length ) - yc.length ) ) > 0 ) {

            for ( ; b--; xc[j++] = 0 ) {
            }
        }

        // Subtract 'yc' from 'xc'.
        for ( b = yc.length; b > a; ){

            if ( xc[--b] < yc[b] ) {

                for ( i = b; i && !xc[--i]; xc[i] = 9 ) {
                }
                --xc[i];
                xc[b] += 10
            }
            xc[b] -= yc[b]
        }

        // Remove trailing zeros.
        for ( ; xc[--j] == 0; xc.pop() ) {
        }

        // Remove leading zeros and adjust exponent accordingly.
        for ( ; xc[0] == 0; xc.shift(), --ye ) {
        }

        if ( !xc[0] ) {

            // n - n = +0
            y['s'] = 1;

            // Result must be zero.
            xc = [ye = 0]
        }

        return y['c'] = xc, y['e'] = ye, y
    };


    /*
     * Return a new Big whose value is the value of this Big modulo the
     * value of Big 'y'.
     */
    P['mod'] = function ( y ) {
        y = new Big( y );
        var c,
            x = this,
            i = x['s'],
            j = y['s'];

        if ( !y['c'][0] ) {
            throwErr( NaN )
        }

        x['s'] = y['s'] = 1;
        c = y.cmp( x ) == 1;
        x['s'] = i, y['s'] = j;

        return c
          ? new Big(x)
          : ( i = Big['DP'], j = Big['RM'],
            Big['DP'] = Big['RM'] = 0,
              x = x['div'](y),
                Big['DP'] = i, Big['RM'] = j,
                  this['minus']( x['times'](y) ) )
    };


    /*
     * Return a new Big whose value is the value of this Big plus the value
     * of Big 'y'.
     */
    P['plus'] = function ( y ) {
        var d,
            x = this,
            a = x['s'],
            b = ( y = new Big( y ) )['s'];

        // Signs differ?
        if ( a != b ) {
            return y['s'] = -b, x['minus'](y)
        }

        var xe = x['e'],
            xc = x['c'],
            ye = y['e'],
            yc = y['c'];

        // Either zero?
        if ( !xc[0] || !yc[0] ) {

            // 'y' is non-zero?
            return yc[0]
              ? y
              : new Big( xc[0]

                // 'x' is non-zero?
                ? x

                // Both are zero. Return zero.
                : a * 0 )
        }

        // Prepend zeros to equalise exponents.
        // Note: Faster to use reverse then do unshifts.
        if ( xc = xc.slice(), a = xe - ye ) {
            d = a > 0 ? ( ye = xe, yc ) : ( a = -a, xc );

            for ( d.reverse(); a--; d.push(0) ) {
            }
            d.reverse()
        }

        // Point 'xc' to the longer array.
        if ( xc.length - yc.length < 0 ) {
            d = yc, yc = xc, xc = d
        }

        /*
         * Only start adding at 'yc.length - 1' as the
         * further digits of 'xc' can be left as they are.
         */
        for ( a = yc.length, b = 0; a;
             b = ( xc[--a] = xc[a] + yc[a] + b ) / 10 ^ 0, xc[a] %= 10 ) {
        }

        // No need to check for zero, as +x + +y != 0 && -x + -y != 0

        if ( b ) {
            xc.unshift(b);
            ++ye
        }

         // Remove trailing zeros.
        for ( a = xc.length; xc[--a] == 0; xc.pop() ) {
        }

        return y['c'] = xc, y['e'] = ye, y
    };


    /*
     * Return a Big whose value is the value of this Big raised to the power
     * 'e'. If 'e' is negative, round, if necessary, to a maximum of 'Big.DP'
     * decimal places using rounding mode 'Big.RM'.
     *
     * e {number} Integer, -MAX_POWER to MAX_POWER inclusive.
     */
    P['pow'] = function ( e ) {
        var isNeg = e < 0,
            x = new Big(this),
            y = ONE;

        if ( e !== ~~e || e < -MAX_POWER || e > MAX_POWER ) {
            throwErr( '!pow!' )
        }

        for ( e = isNeg ? -e : e; ; ) {

            if ( e & 1 ) {
                y = y['times'](x)
            }
            e >>= 1;

            if ( !e ) {
                break
            }
            x = x['times'](x)
        }

        return isNeg ? ONE['div'](y) : y
    };


    /*
     * Return a new Big whose value is the value of this Big rounded, if
     * necessary, to a maximum of 'dp' decimal places using rounding mode 'rm'.
     * If 'dp' is not specified, round to 0 decimal places.
     * If 'rm' is not specified, use 'Big.RM'.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     * [rm] 0, 1, 2 or 3 ( ROUND_DOWN, ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_UP )
     */
    P['round'] = function ( dp, rm ) {
        var x = new Big(this);

        if ( dp == null ) {
            dp = 0
        } else if ( dp !== ~~dp || dp < 0 || dp > MAX_DP ) {
            throwErr( '!round!' )
        }
        rnd( x, dp, rm == null ? Big['RM'] : rm );

        return x
    };


    /*
     * Return a new Big whose value is the square root of the value of this
     * Big, rounded, if necessary, to a maximum of 'Big.DP' decimal places
     * using rounding mode 'Big.RM'.
     */
    P['sqrt'] = function () {
        var estimate, r, approx,
            x = this,
            xc = x['c'],
            i = x['s'],
            e = x['e'],
            half = new Big('0.5');

        // Zero?
        if ( !xc[0] ) {
            return new Big(x)
        }

        // Negative?
        if ( i < 0 ) {
            throwErr( NaN )
        }

        // Estimate.
        i = Math.sqrt( x.toString() );

        // Math.sqrt underflow/overflow?
        // Pass 'x' to Math.sqrt as integer, then adjust the exponent of the result.
        if ( i == 0 || i == 1 / 0 ) {
            estimate = xc.join('');

            if ( !( estimate.length + e & 1 ) ) {
                estimate += '0'
            }

            r = new Big( Math.sqrt(estimate).toString() );
            r['e'] = ( ( ( e + 1 ) / 2 ) | 0 ) - ( e < 0 || e & 1 )
        } else {
            r = new Big( i.toString() )
        }

        i = r['e'] + ( Big['DP'] += 4 );

        // Newton-Raphson loop.
        do {
            approx = r;
            r = half['times']( approx['plus']( x['div'](approx) ) )
        } while ( approx['c'].slice( 0, i ).join('') !==
                       r['c'].slice( 0, i ).join('') );

        rnd( r, Big['DP'] -= 4, Big['RM'] );

        return r
    };


    /*
     * Return a new Big whose value is the value of this Big times the value
     * of Big 'y'.
     */
    P['times'] = function ( y ) {
        var c,
            x = this,
            xc = x['c'],
            yc = ( y = new Big( y ) )['c'],
            a = xc.length,
            b = yc.length,
            i = x['e'],
            j = y['e'];

        y['s'] = x['s'] == y['s'] ? 1 : -1;

        // Either 0?
        if ( !xc[0] || !yc[0] ) {

            return new Big( y['s'] * 0 )
        }

        y['e'] = i + j;

        if ( a < b ) {
            c = xc, xc = yc, yc = c, j = a, a = b, b = j
        }

        for ( j = a + b, c = []; j--; c.push(0) ) {
        }

        // Multiply!
        for ( i = b - 1; i > -1; i-- ) {

            for ( b = 0, j = a + i;
                  j > i;
                  b = c[j] + yc[i] * xc[j - i - 1] + b,
                  c[j--] = b % 10 | 0,
                  b = b / 10 | 0 ) {
            }

            if ( b ) {
                c[j] = ( c[j] + b ) % 10
            }
        }

        b && ++y['e'];

        // Remove any leading zero.
        !c[0] && c.shift();

        // Remove trailing zeros.
        for ( j = c.length; !c[--j]; c.pop() ) {
        }

        return y['c'] = c, y
    };


    /*
     * Return a string representing the value of this Big.
     * Return exponential notation if this Big has a positive exponent equal
     * to or greater than 'TO_EXP_POS', or a negative exponent equal to or less
     * than 'TO_EXP_NEG'.
     */
    P['toString'] = P['valueOf'] = P['toJSON'] = function () {
        var x = this,
            e = x['e'],
            str = x['c'].join(''),
            strL = str.length;

        // Exponential notation?
        if ( e <= TO_EXP_NEG || e >= TO_EXP_POS ) {
            str = str.charAt(0) + ( strL > 1 ?  '.' + str.slice(1) : '' ) +
              ( e < 0 ? 'e' : 'e+' ) + e

        // Negative exponent?
        } else if ( e < 0 ) {

        // Prepend zeros.
            for ( ; ++e; str = '0' + str ) {
            }
            str = '0.' + str

        // Positive exponent?
        } else if ( e > 0 ) {

            if ( ++e > strL ) {

                // Append zeros.
                for ( e -= strL; e-- ; str += '0' ) {
                }
            } else if ( e < strL ) {
                str = str.slice( 0, e ) + '.' + str.slice(e)
            }

        // Exponent zero.
        } else if ( strL > 1 ) {
            str = str.charAt(0) + '.' + str.slice(1)
        }

        // Avoid '-0'
        return x['s'] < 0 && x['c'][0] ? '-' + str : str
    };


    /*
     ***************************************************************************
     * If 'toExponential', 'toFixed', 'toPrecision' and 'format' are not
     * required they can safely be commented-out or deleted. No redundant code
     * will be left. 'format' is used only by 'toExponential', 'toFixed' and
     * 'toPrecision'.
     ***************************************************************************
     */


    /*
     * PRIVATE FUNCTION
     *
     * Return a string representing the value of Big 'x' in normal or
     * exponential notation to a fixed number of decimal places or significant
     * digits 'dp'.
     * (Called by toString, toExponential, toFixed and toPrecision.)
     *
     * x {Big} The Big to format.
     * dp {number} Integer, 0 to MAX_DP inclusive.
     * toE {number} undefined (toFixed), 1 (toExponential) or 2 (toPrecision).
     */
    function format( x, dp, toE ) {
        // The index (in normal notation) of the digit that may be rounded up.
        var i = dp - ( x = new Big(x) )['e'],
            c = x['c'];

        // Round?
        if ( c.length > ++dp ) {
            rnd( x, i, Big['RM'] )
        }

        // Recalculate 'i' if toFixed as 'x.e' may have changed if value rounded up.
        i = !c[0] ? i + 1 : toE ? dp : ( c = x['c'], x['e'] + i + 1 );

        // Append zeros?
        for ( ; c.length < i; c.push(0) ) {
        }
        i = x['e'];

        /*
         * 'toPrecision' returns exponential notation if the number of
         * significant digits specified is less than the number of digits
         * necessary to represent the integer part of the value in normal
         * notation.
         */
        return toE == 1 || toE == 2 && ( dp <= i || i <= TO_EXP_NEG )

            // Exponential notation.
            ? ( x['s'] < 0 && c[0] ? '-' : '' ) + ( c.length > 1
              ? ( c.splice( 1, 0, '.' ), c.join('') )
              : c[0] ) + ( i < 0 ? 'e' : 'e+' ) + i

            // Normal notation.
            : x.toString()
    }


    /*
     * Return a string representing the value of this Big in exponential
     * notation to 'dp' fixed decimal places and rounded, if necessary, using
     * 'Big.RM'.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     */
    P['toExponential'] = function ( dp ) {

        if ( dp == null ) {
            dp = this['c'].length - 1
        } else if ( dp !== ~~dp || dp < 0 || dp > MAX_DP ) {
            throwErr( '!toExp!' )
        }

        return format( this, dp, 1 )
    };


    /*
     * Return a string representing the value of this Big in normal notation
     * to 'dp' fixed decimal places and rounded, if necessary, using 'Big.RM'.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     */
    P['toFixed'] = function ( dp ) {
        var str,
            x = this,
            neg = TO_EXP_NEG,
            pos = TO_EXP_POS;

        TO_EXP_NEG = -( TO_EXP_POS = 1 / 0 );

        if ( dp == null ) {
            str = x.toString()
        } else if ( dp === ~~dp && dp >= 0 && dp <= MAX_DP ) {
            str = format( x, x['e'] + dp );

            // (-0).toFixed() is '0', but (-0.1).toFixed() is '-0'.
            // (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
            if ( x['s'] < 0 && x['c'][0] && str.indexOf('-') < 0 ) {
                // As e.g. -0.5 if rounded to -0 will cause toString to omit the minus sign.
                str = '-' + str
            }
        }
        TO_EXP_NEG = neg, TO_EXP_POS = pos;

        if ( !str ) {
            throwErr( '!toFix!' )
        }

        return str
    };


    /*
     * Return a string representing the value of this Big to 'sd' significant
     * digits and rounded, if necessary, using 'Big.RM'. If 'sd' is less than
     * the number of digits necessary to represent the integer part of the value
     * in normal notation, then use exponential notation.
     *
     * sd {number} Integer, 1 to MAX_DP inclusive.
     */
    P['toPrecision'] = function ( sd ) {

        if ( sd == null ) {
            return this.toString()
        } else if ( sd !== ~~sd || sd < 1 || sd > MAX_DP ) {
            throwErr( '!toPre!' )
        }

        return format( this, sd - 1, 2 )
    };


    // EXPORT


    // Node and other CommonJS-like environments that support module.exports.
    if ( typeof module !== 'undefined' && module.exports ) {
        module.exports = Big

    //AMD.
    } else if ( typeof define == 'function' && define.amd ) {
        define( function () {
            return Big
        })

    //Browser.
    } else {
        global['Big'] = Big
    }

})( this );

},{}]},{},[10])
(10)
});