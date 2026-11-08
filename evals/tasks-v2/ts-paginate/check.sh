#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { paginate } from "./src/paginate.ts";
import { listUsers } from "./src/api.ts";
try {
  const empty = paginate([], 1, 10);
  assert.deepEqual([empty.items, empty.totalPages, empty.hasNext], [[], 1, false]);
  const twenty = Array.from({ length: 20 }, (_, i) => i);
  const p2 = paginate(twenty, 2, 10);
  assert.deepEqual([p2.items.length, p2.totalPages, p2.hasNext], [10, 2, false]);
  assert.throws(() => paginate(twenty, 0, 10), RangeError);
  assert.throws(() => paginate(twenty, 3, 10), RangeError);
  const first = listUsers({});
  assert.deepEqual([first.page, first.items.length, first.hasNext, first.totalPages], [1, 10, true, 3]);
  assert.equal(listUsers({ page: "abc" }).page, 1);
} catch (e) {
  console.error("hidden check failed: " + e.message);
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
