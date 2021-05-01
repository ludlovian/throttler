# throttler
Rate limiting transform stream

**NOTE** You should now be using the async gen export at **/gen**

## API

### throttler
```
import throttler from 'throttler/gen'

th = throttler(rate | { rate })
```

Constructs a passthrough stream which throttles transfers at the rate given.

Rate is specified in bytes per second, and copes with "K" and "M" suffixes

There are other options, but you really don't want to fiddle with these!
