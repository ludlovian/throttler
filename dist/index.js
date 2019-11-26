'use strict';

var stream = require('stream');

function throttler (options) {
  if (typeof options !== 'object') options = { rate: options };
  const bytesPerSecond = ensureNumber(options.rate);
  const chunkSize = Math.max(Math.ceil(bytesPerSecond / 10));
  const stream$1 = new stream.Transform({
    ...options,
    transform (data, encoding, callback) {
      takeChunk.call(this, data, callback);
    }
  });
  Object.assign(stream$1, {
    bytesPerSecond,
    chunkSize,
    chunkBytes: 0,
    windowMaxTimeMs: 30 * 1000
  });
  resetWindow.call(stream$1);
  return stream$1
}
function takeChunk (data, done) {
  const chunk = data.slice(0, this.chunkSize - this.chunkBytes);
  const rest = data.slice(chunk.length);
  if (rest.length) {
    processChunk.call(this, chunk, takeChunk.bind(this, rest, done));
  } else {
    processChunk.call(this, chunk, done);
  }
}
function processChunk (data, done) {
  const size = data.length;
  this.chunkBytes += size;
  this.windowBytes += size;
  if (this.chunkBytes < this.chunkSize) {
    return pushChunk.call(this, data, done)
  }
  this.chunkBytes -= this.chunkSize;
  const delay = calculateDelay.call(this);
  if (!delay) {
    pushChunk.call(this, data, done);
  } else {
    setTimeout(pushChunk.bind(this, data, done), delay);
  }
}
function pushChunk (chunk, done) {
  this.push(chunk);
  done();
}
function calculateDelay () {
  const windowTimeMs = getTimeMs() - this.windowStartMs;
  const expectedTimeMs = (1e3 * this.windowBytes) / this.bytesPerSecond;
  if (windowTimeMs > this.windowMaxTimeMs) resetWindow.call(this);
  return Math.max(expectedTimeMs - windowTimeMs, 0)
}
function resetWindow () {
  this.windowStartMs = getTimeMs();
  this.windowBytes = 0;
}
function getTimeMs () {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1e3 + Math.floor(nanoseconds / 1e6)
}
function ensureNumber (value) {
  let n = (value + '').toLowerCase();
  const m = n.endsWith('m') ? 1024 * 1024 : n.endsWith('k') ? 1024 : 1;
  n = parseInt(n.replace(/[mk]$/, ''));
  if (isNaN(n)) throw new Error(`Cannot understand number "${value}"`)
  return n * m
}

module.exports = throttler;
