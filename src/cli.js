'use strict'

import throttler from './index.js'
const t = throttler(process.argv[2])
process.stdin.pipe(t).pipe(process.stdout)
