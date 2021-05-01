import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { pipeline } from 'stream/promises'

import throttler from '../src/gen.mjs'
;[
  ['read 10k at 10k', 1e4, 1e4, 1e3],
  ['read 1kiB at 1kiB', 1024, 1024, 1e3],
  ['read 15M at 5M', 15e6, '5M', 3e3],
  // throttle set just above actual rate of 1M per half second
  ['large chunks no throttle', 4e6, '2100K', 2e3, 1e6, 500],
  // one byte every 1/10 of second
  ['slow stream', 15, 1e3, 1500, 1, 100]
].map(makeTest)

test('invalid construction', () => {
  assert.throws(() => throttler({ rate: '7q' }), /Invalid rate/)
})

let result

function makeTest ([name, size, rate, dur, chunk, delay, tol = 0.1]) {
  test(name, async () => {
    const start = Date.now()
    await pipeline(random({ size, chunk, delay }), throttler(rate), sink)
    const end = Date.now()
    assert.is(result, size)
    assert.ok(Math.abs(end - start - dur) / dur < tol)
  })
}

async function * random ({ size, chunk, delay }) {
  chunk = chunk || Math.ceil(size / 10)
  while (size) {
    const n = Math.min(size, chunk)
    size -= n
    if (delay) await sleep(delay)
    yield Buffer.allocUnsafe(n)
  }
}

async function * sink (source) {
  let size = 0
  for await (const chunk of source) {
    size += chunk.length
  }
  result = size
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

test.run()
