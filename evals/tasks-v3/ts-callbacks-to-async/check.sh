#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { NotFoundError, readItem, reset, writeItem } from "./src/store.ts";
import { copy, welcome } from "./src/service.ts";
try {
  reset();
  const p = readItem("greeting");
  assert.ok(p instanceof Promise, "readItem returns a Promise");
  assert.equal(await p, "hello");
  assert.equal(readItem.length, 1, "readItem takes only a key");
  assert.equal(writeItem.length, 2, "writeItem takes a key and a value");
  const w = welcome();
  assert.ok(w instanceof Promise, "welcome returns a Promise");
  assert.equal(await w, "hello, world");
  await copy("greeting", "copy1");
  assert.equal(await readItem("copy1"), "hello");
  await assert.rejects(copy("missing", "copy2"), (e) => e instanceof NotFoundError && e.message === "not found: missing");
  await assert.rejects(readItem("copy2"), NotFoundError, "a failed copy writes nothing");
} catch (e) {
  console.error("hidden check failed: " + String(e.message).replace(/\s*\n\s*/g, " "));
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
