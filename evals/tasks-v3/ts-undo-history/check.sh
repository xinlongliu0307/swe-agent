#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import fs from "node:fs";
import { Editor } from "./src/editor.ts";
try {
  assert.ok(fs.existsSync("src/history.ts"), "the history lives in src/history.ts");
  const e = new Editor();
  assert.equal(e.undo(), false, "nothing to undo yet");
  e.type("hello");
  e.type(" world");
  e.erase(6);
  assert.equal(e.text, "hello");
  assert.equal(e.undo(), true);
  assert.deepEqual([e.text, e.cursor], ["hello world", 11], "undo an erase");
  assert.equal(e.undo(), true);
  assert.deepEqual([e.text, e.cursor], ["hello", 5], "undo a type");
  assert.equal(e.redo(), true);
  assert.deepEqual([e.text, e.cursor], ["hello world", 11], "redo a type");
  e.type("!");
  assert.equal(e.redo(), false, "a new edit clears the redo history");
  e.erase(0);
  e.type("");
  assert.equal(e.undo(), true);
  assert.equal(e.text, "hello world", "edits that change nothing are not recorded");
  const b = new Editor();
  b.type("abc");
  b.erase(1);
  b.undo();
  assert.equal(b.cursor, 3, "undoing an erase puts the cursor back after the restored text");
  b.type("d");
  assert.equal(b.text, "abcd");
  const small = new Editor(2);
  small.type("a");
  small.type("b");
  small.type("c");
  assert.equal(small.undo(), true);
  assert.equal(small.undo(), true);
  assert.equal(small.undo(), false, "only the last 2 edits are kept");
  assert.equal(small.text, "a");
} catch (e) {
  console.error("hidden check failed: " + String(e.message).replace(/\s*\n\s*/g, " "));
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
