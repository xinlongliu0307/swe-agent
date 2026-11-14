Bug report: "Since we added the read cache, GET /orders/:id sometimes returns the wrong total after
an order is changed with PATCH (new lines or a different coupon). I think the cache in
src/store/cache.ts serves stale orders; please fix it." The existing tests pass. Find the real cause
and fix it. Reads of an unchanged order must still be served from the cache. Do not edit the tests.
