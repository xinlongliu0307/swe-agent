#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { parseQuery } from "./src/query.ts";
import { route } from "./src/router.ts";
try {
  assert.deepEqual(parseQuery("?a=1&a=2&b"), { a: ["1", "2"], b: "" });
  assert.deepEqual(parseQuery("x=a%20b%2Bc"), { x: "a b+c" });
  assert.deepEqual(parseQuery("eq=a=b"), { eq: "a=b" });
  assert.deepEqual(parseQuery(""), {});
  assert.deepEqual(route("/home"), { path: "/home", query: {} });
} catch (e) {
  console.error("hidden check failed: " + e.message);
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
