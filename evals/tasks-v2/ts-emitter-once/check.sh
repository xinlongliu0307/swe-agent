#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { Emitter } from "./src/emitter.ts";
import { Store } from "./src/store.ts";
try {
  let e = new Emitter(); let n = 0;
  e.once(() => n++); e.emit(1); e.emit(2);
  assert.equal(n, 1, "once fires once");
  e = new Emitter(); n = 0;
  const stop = e.once(() => n++); stop(); e.emit(1);
  assert.equal(n, 0, "once can be cancelled");
  e = new Emitter(); n = 0;
  const f = () => n++; e.on(f); e.off(f); e.emit(1);
  assert.equal(n, 0, "off removes");
  e = new Emitter(); const order = [];
  e.on(() => { order.push("a"); e.on(() => order.push("late")); });
  e.emit(1);
  assert.deepEqual(order, ["a"], "listeners added during emit wait for the next emit");
  e = new Emitter(); const seen = [];
  const b = () => seen.push("b");
  e.on(() => { seen.push("a"); e.off(b); }); e.on(b);
  e.emit(1);
  assert.deepEqual(seen, ["a", "b"], "removal during emit does not affect the current emit");
  const s = new Store(0); const got = [];
  s.onFirstChange((v) => got.push(v)); s.set(1); s.set(2);
  assert.deepEqual(got, [1], "onFirstChange fires only once");
} catch (e) {
  console.error("hidden check failed: " + e.message);
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
