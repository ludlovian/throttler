'use strict';

var stream = require('stream');

class Throttler extends stream.Transform {
  constructor (options) {
    if (typeof options !== 'object') options = { rate: options };
    super(options);
    const {
      rate,
      chunkTime = 100,
      windowSize = 30
    } = options;
    const bytesPerSecond = ensureNumber(rate);
    Object.assign(this, {
      bytesPerSecond,
      chunkSize: Math.max(1, Math.ceil((bytesPerSecond * chunkTime) / 1e3)),
      chunkBytes: 0,
      totalBytes: 0,
      windowSize,
      window: [[0, Date.now()]]
    });
    this.on('pipe', src => src.once('error', err => this.emit('error', err)));
  }
  _transform (data, enc, callback) {
    while (true) {
      if (!data.length) return callback()
      const chunk = data.slice(0, this.chunkSize - this.chunkBytes);
      const rest = data.slice(chunk.length);
      this.chunkBytes += chunk.length;
      if (this.chunkBytes < this.chunkSize) {
        this.push(chunk);
        return callback()
      }
      this.chunkBytes -= this.chunkSize;
      this.totalBytes += this.chunkSize;
      const now = Date.now();
      const [startBytes, startTime] = this.window[0];
      const eta =
        startTime + ((this.totalBytes - startBytes) * 1e3) / this.bytesPerSecond;
      this.window.push([this.totalBytes, Math.max(now, eta)]);
      if (this.window.length > this.windowSize) {
        this.window.splice(0, this.windowLength - this.windowSize);
      }
      if (now > eta) {
        this.push(chunk);
        data = rest;
        continue
      }
      return setTimeout(() => {
        this.push(chunk);
        this._transform(rest, enc, callback);
      }, eta - now)
    }
  }
}
function throttler (options) {
  return new Throttler(options)
}
function ensureNumber (value) {
  let n = (value + '').toLowerCase();
  const m = n.endsWith('m') ? 1024 * 1024 : n.endsWith('k') ? 1024 : 1;
  n = parseInt(n.replace(/[mk]$/, ''));
  if (isNaN(n)) throw new Error(`Cannot understand number "${value}"`)
  return n * m
}

module.exports = throttler;
