import test from 'ava'
import { Readable, Transform } from 'stream'

import throttle from '../src/index.mjs'

test('read 10k at 10k', testStream, 10000, undefined, undefined, 10000, 1000)
test(
  'read 1kiB stream at 1kiB',
  testStream,
  1024,
  undefined,
  undefined,
  1024,
  1000
)
test('read 15M at 5M', testStream, 15 * 1e6, undefined, undefined, '5M', 3000)
test(
  'read in larger chunks, but not throttle',
  testStream,
  4 * 1000 * 1000, // send 4M
  1 * 1000 * 1000, // in 1M chunks
  500, //             twice a second
  '2100K', //         limit to 2.1M (just above rate)
  2000 //             should take 2s
)
test(
  'read slow stream',
  testStream,
  15, //              15 bytes
  1, //               in 1 byte chunks
  100, //             at 10 B/s
  1000, //            limited to 1KB/s
  1500 //             shoudl take 1.5s
)

function testStream (t, size, chunk, delay, rate, dur) {
  return new Promise((resolve, reject) => {
    let bytes = 0
    const start = now()
    random(size, chunk, delay)
      .pipe(throttle(rate))
      .on('data', d => {
        bytes += d.length
      })
      .on('error', reject)
      .on('end', () => {
        t.is(bytes, size)
        t.true(checkTime(start, dur))
        resolve()
      })
  })
}

test('invalid construction', t => {
  t.throws(() => throttle('xyz'), { instanceOf: Error })
})

test('complex construction', t => {
  const thr = throttle({ rate: '2m' })
  t.true(thr instanceof Transform)
})

test.cb('roll window', t => {
  random(4 * 1000 * 1000, 100 * 1000)
    .pipe(throttle({ rate: '1m', chunkTime: 50, windowLength: 20 }))
    .on('error', t.end)
    .on('end', () => t.end())
    .resume()
})

test.cb('piped errors passed on', t => {
  const source = new Readable({
    read () {}
  })
  const err = new Error('oops')
  const thr = throttle({ rate: '1k' })
  source.pipe(thr)
  thr.on('error', e => {
    t.is(e, err)
    t.end()
  })
  setImmediate(() => {
    source.push(Buffer.from('foo'))
    setImmediate(() => {
      source.emit('error', err)
    })
  })
})

function random (size, chunk, delay) {
  return new Readable({
    read (hint) {
      if (!size) return this.push(null)
      const n = Math.min(size, chunk || hint)
      size -= n
      const b = Buffer.allocUnsafe(n)
      if (delay) {
        setTimeout(() => {
          this.push(b)
        }, delay)
      } else {
        this.push(b)
      }
    }
  })
}

function now () {
  return +new Date()
}

function checkTime (start, dur, tol = 0.1) {
  const end = now()
  const diff = Math.abs(end - start - dur) / dur
  return diff < tol
}