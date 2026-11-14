We are moving the store API from callbacks to Promises. A colleague has already rewritten the tests
in test/ for the new API, so they fail now. In the new API readItem(key) and writeItem(key, value)
in src/store.ts return Promises instead of taking a callback, and welcome() and copy(from, to) in
src/service.ts return Promises too. Migrate src/store.ts and src/service.ts so the tests pass.
Errors must keep their type (NotFoundError) and message. Do not edit the tests.
