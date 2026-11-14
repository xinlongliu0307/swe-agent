#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
trap 'rm -f .hidden_check.mjs' EXIT
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { createApp } from "./src/index.ts";
import { ManualClock } from "./src/util/clock.ts";
try {
  const app = createApp(new ManualClock());
  const created = app.handle("POST", "/orders", { lines: [{ sku: "A", qty: 2 }], coupon: null });
  const id = created.body.id;
  assert.equal(created.body.totalCents, 2500);
  let r = app.handle("PATCH", `/orders/${id}`, { lines: [{ sku: "A", qty: 2 }, { sku: "C", qty: 1 }] });
  assert.equal(r.body.totalCents, 12500, "PATCH with new lines returns the new total");
  assert.equal(app.handle("GET", `/orders/${id}`).body.totalCents, 12500, "GET after PATCH (new lines)");
  app.handle("PATCH", `/orders/${id}`, { coupon: "HALF" });
  assert.equal(app.handle("GET", `/orders/${id}`).body.totalCents, 6250, "GET after PATCH (coupon added)");
  app.handle("PATCH", `/orders/${id}`, { coupon: null });
  assert.equal(app.handle("GET", `/orders/${id}`).body.total, "AUD 125.00", "GET after PATCH (coupon removed)");
  const other = app.handle("POST", "/orders", { lines: [{ sku: "B", qty: 3 }] }).body;
  assert.equal(other.totalCents, 1197);
  const before = app.store.reads;
  for (let i = 0; i < 3; i++) app.handle("GET", `/orders/${other.id}`);
  assert.equal(app.store.reads - before, 1, "reads of an unchanged order are still served from the cache");
} catch (e) {
  console.error("hidden check failed: " + String(e.message).replace(/\s*\n\s*/g, " "));
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
