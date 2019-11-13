# throttler
Rate limiting transform stream

## API

### throttler
`th = throttler(rate | options)`

Constructs a passthrough stream which throttles transfers at the rate given.

Rate is specified in bytes per second, and copes with "K" and "M" suffixes
