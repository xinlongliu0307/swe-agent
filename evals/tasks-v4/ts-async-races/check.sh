#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
trap 'rm -f .hidden_check.mjs' EXIT
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { ApiClient, FakeBackend, SearchBox } from "./src/index.ts";
try {
  const be = new FakeBackend({ userDelayMs: 20 });
  const api = new ApiClient(be);
  const [a, b, c] = await Promise.all([api.getUser("u1"), api.getUser("u1"), api.getUser("u2")]);
  assert.deepEqual([a.name, b.name, c.name], ["Ada", "Ada", "Adam"]);
  assert.equal(be.userCalls, 2, "concurrent calls for the same id share one request");
  await api.getUser("u1");
  assert.equal(be.userCalls, 2, "a user is cached after the first response");
  const be2 = new FakeBackend({ userDelayMs: 10 });
  be2.failNextUser = 503;
  const api2 = new ApiClient(be2);
  const settled = await Promise.allSettled([api2.getUser("u3"), api2.getUser("u3")]);
  assert.deepEqual(settled.map((s) => s.status), ["rejected", "rejected"], "both callers see the failure");
  assert.equal(be2.userCalls, 1, "a failing request is shared too");
  assert.equal((await api2.getUser("u3")).name, "Alan", "a failed request is not cached");
  assert.equal(be2.userCalls, 2);
  await Promise.all([api2.getUser("u3"), api2.getUser("u3")]);
  assert.equal(be2.userCalls, 2);
  const be3 = new FakeBackend({ searchDelayMs: (q) => (q === "a" ? 60 : 10) });
  const box = new SearchBox(new ApiClient(be3));
  const shown = [];
  box.changes.on((users) => shown.push(users.map((u) => u.name).join(",")));
  await Promise.all([box.search("a"), box.search("ad")]);
  assert.deepEqual(box.results.map((u) => u.name), ["Ada", "Adam"], "results are for the latest query");
  assert.deepEqual(shown, ["Ada,Adam"], "the changes event never shows results of an older query");
  await Promise.all([box.search("al"), box.search("")]);
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(box.results, [], "clearing the box wins over an earlier query still in flight");
  await box.search("b");
  assert.deepEqual(box.results.map((u) => u.name), ["Bo"]);
} catch (e) {
  console.error("hidden check failed: " + String(e.message).replace(/\s*\n\s*/g, " "));
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
