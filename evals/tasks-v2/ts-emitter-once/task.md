Finish the Emitter in src/emitter.ts: on() must return a function that removes that listener; add
off(listener) to remove a listener; add once(listener), which runs at most once and also returns a
function that removes it. Listeners added or removed while emit() is running must not change which
listeners that emit() calls (it should work on a snapshot). Then make Store.onFirstChange in
src/store.ts use once() so that it really fires only for the first change. Do not edit the tests.
