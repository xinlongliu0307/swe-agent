#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { retry } from "./src/retry.ts";
import { getText } from "./src/client.ts";
try {
  let calls = 0;
  await assert.rejects(retry(async () => { calls++; throw new Error("e" + calls); }, { retries: 2, baseMs: 1 }), /e3/);
  assert.equal(calls, 3, "1 try + 2 retries, then the last error");
  calls = 0;
  await assert.rejects(retry(async () => { calls++; throw Object.assign(new Error("no"), { retryable: false }); }, { retries: 5, baseMs: 1 }));
  assert.equal(calls, 1, "retryable: false is not retried");
  calls = 0; const t0 = Date.now();
  await assert.rejects(retry(async () => { calls++; throw new Error("x"); }, { retries: 2, baseMs: 30 }));
  assert.ok(Date.now() - t0 >= 85, "waits 30 then 60 ms");
  const seq = (...rs) => { let i = 0; return async () => { const r = rs[Math.min(i++, rs.length - 1)]; if (r instanceof Error) throw r; return r; }; };
  let f = seq({ status: 503, body: "" }, { status: 200, body: "hello" });
  assert.equal(await getText(f, "u", 1), "hello", "5xx is retried");
  f = seq(new Error("net"), { status: 200, body: "ok" });
  assert.equal(await getText(f, "u", 1), "ok", "network errors are retried");
  let n = 0; const notFound = async () => { n++; return { status: 404, body: "" }; };
  await assert.rejects(getText(notFound, "u", 1), (e) => e.retryable === false);
  assert.equal(n, 1, "4xx is not retried");
} catch (e) {
  console.error("hidden check failed: " + e.message);
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
