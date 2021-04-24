import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { finished } from 'stream/promises'

import { Readable, Transform } from 'stream'

import throttle from '../src/index.mjs'

makeTest(
  'read 10k at 10k',
  10000, // 10k
  undefined,
  undefined,
  10000, // at 10k
  1000 // should take 1s
)

makeTest(
  'read 1kiB stream at 1kiB',
  1024, //  1k
  undefined,
  undefined,
  1024, // at 1k
  1000 // should take 1s
)

makeTest(
  'read 15M at 5M', // 15M
  15 * 1e6,
  undefined,
  undefined,
  '5M', // at 5M
  3000 // should take 3s
)

makeTest(
  'read in larger chunks, but not throttle',
  4 * 1000 * 1000, // send 4M
  1 * 1000 * 1000, // in 1M chunks
  500, //             twice a second
  '2100K', //         limit to 2.1M (just above rate)
  2000 //             should take 2s
)

makeTest(
  'read slow stream',
  15, //              15 bytes
  1, //               in 1 byte chunks
  100, //             at 10 B/s
  1000, //            limited to 1KB/s
  1500 //             shoudl take 1.5s
)

test('invalid construction', () => {
  assert.throws(() => throttle('xyz'), /Cannot understand number/)
})

test('complex construction', () => {
  const thr = throttle({ rate: '2m' })
  assert.ok(thr instanceof Transform)
})

test('roll window', () => {
  return new Promise((resolve, reject) => {
    random(4 * 1000 * 1000, 100 * 1000)
      .pipe(throttle({ rate: '1m', chunkTime: 50, windowLength: 20 }))
      .on('error', reject)
      .on('end', () => {
        assert.ok(true)
        resolve()
      })
      .resume()
  })
})

test('piped errors passed on', async () => {
  const source = new Readable({
    read () {}
  })
  const err = new Error('oops')
  const thr = throttle({ rate: '1k' })
  source.pipe(thr)
  thr.resume()

  Promise.resolve()
    .then(() => source.push(Buffer.from('foo')))
    .then(() => source.emit('error', err))

  await finished(thr).then(
    () => {
      assert.unreachable()
    },
    e => {
      assert.is(e, err)
    }
  )
})

test.run()

function makeTest (name, size, chunk, delay, rate, dur) {
  test(
    name,
    () =>
      new Promise((resolve, reject) => {
        let bytes = 0
        const start = Date.now()
        random(size, chunk, delay)
          .pipe(throttle(rate))
          .on('data', d => {
            bytes += d.length
          })
          .on('error', reject)
          .on('end', () => {
            assert.is(bytes, size)
            assert.ok(checkTime(start, dur))
            resolve()
          })
      })
  )

  function checkTime (start, dur, tol = 0.1) {
    const end = Date.now()
    const diff = Math.abs(end - start - dur) / dur
    return diff < tol
  }
}

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

/*

*/
