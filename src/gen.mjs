import assert from 'assert/strict'

export default function throttle (options) {
  if (typeof options !== 'object') options = { rate: options }
  const { chunkTime = 100, windowSize = 30 } = options
  const rate = getRate(options.rate)
  return async function * throttle (source) {
    let window = [[0, Date.now()]]
    let bytes = 0
    let chunkBytes = 0
    const chunkSize = Math.max(1, Math.ceil((rate * chunkTime) / 1e3))
    for await (let data of source) {
      while (data.length) {
        const chunk = data.slice(0, chunkSize - chunkBytes)
        data = data.slice(chunk.length)
        chunkBytes += chunk.length
        if (chunkBytes < chunkSize) {
          assert.equal(data.length, 0)
          yield chunk
          continue
        }
        bytes += chunkSize
        assert.equal(chunkBytes, chunkSize)
        chunkBytes = 0
        const now = Date.now()
        const first = window[0]
        const eta = first[1] + (1e3 * (bytes - first[0])) / rate
        window = [...window, [bytes, Math.max(now, eta)]].slice(-windowSize)
        if (now < eta) {
          await delay(eta - now)
        }
        yield chunk
      }
    }
  }
}

function getRate (val) {
  const n = (val + '').toLowerCase()
  if (!/^\d+[mk]?$/.test(n)) throw new Error(`Invalid rate: ${val}`)
  const m = n.endsWith('m') ? 1024 * 1024 : n.endsWith('k') ? 1024 : 1
  return parseInt(n) * m
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
