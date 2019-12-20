'use strict'
import { Transform } from 'stream'

// throttler
//
// creates a rate-throttling stream
//
// throttling is performed by passing the stream through, and once a "chunk"
// of data has been reached, then assessing if the last bit of that chunk
// has arrived too early, and delaying if so.
//
// The rate is specified in bytes-per-second (with 'k' or 'm' suffixes meaning
// KiB or MiB). By default, the chunk size is taken to be maximum amount
// permitted in 100ms. The determination over whether it is too early uses
// a sliding window of chunk completion times - by default the window
// is 30 chunks (3 seconds at 100ms)

class Throttler extends Transform {
  constructor (options) {
    if (typeof options !== 'object') options = { rate: options }
    super(options)
    const {
      rate,
      chunkTime = 100, // at max speed, how big is a chunk (in ms)
      windowSize = 30 // how many chunks in the window
    } = options
    const bytesPerSecond = ensureNumber(rate)
    Object.assign(this, {
      bytesPerSecond,
      chunkSize: Math.max(1, Math.ceil((bytesPerSecond * chunkTime) / 1e3)),
      chunkBytes: 0,
      totalBytes: 0,
      windowSize,
      window: [[0, Date.now()]]
    })
    this.on('pipe', src => src.once('error', err => this.emit('error', err)))
  }

  _transform (data, enc, callback) {
    while (true) {
      if (!data.length) return callback()
      const chunk = data.slice(0, this.chunkSize - this.chunkBytes)
      const rest = data.slice(chunk.length)
      this.chunkBytes += chunk.length

      // if we still do not have a full chunk, then just send it out
      if (this.chunkBytes < this.chunkSize) {
        // require('assert').strict.equal(rest.length, 0)
        this.push(chunk)
        return callback()
      }

      // we now have a full chunk
      this.chunkBytes -= this.chunkSize
      this.totalBytes += this.chunkSize
      // require('assert').strict.equal(this.chunkBytes, 0)

      // when should this chunk be going out?
      const now = Date.now()
      const [startBytes, startTime] = this.window[0]
      const eta =
        startTime + ((this.totalBytes - startBytes) * 1e3) / this.bytesPerSecond

      this.window.push([this.totalBytes, Math.max(now, eta)])
      if (this.window.length > this.windowSize) {
        this.window.splice(0, this.windowLength - this.windowSize)
      }

      // are we too late - so just send out already - and come round again
      if (now > eta) {
        this.push(chunk)
        data = rest
        continue
      }

      // so we are too early - so send it later
      return setTimeout(() => {
        this.push(chunk)
        this._transform(rest, enc, callback)
      }, eta - now)
    }
  }
}

export default function throttler (options) {
  return new Throttler(options)
}

function ensureNumber (value) {
  let n = (value + '').toLowerCase()
  const m = n.endsWith('m') ? 1024 * 1024 : n.endsWith('k') ? 1024 : 1
  n = parseInt(n.replace(/[mk]$/, ''))
  if (isNaN(n)) throw new Error(`Cannot understand number "${value}"`)
  return n * m
}
