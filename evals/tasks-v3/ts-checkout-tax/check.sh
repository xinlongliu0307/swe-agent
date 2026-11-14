#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
trap 'rm -f .hidden_check.mjs' EXIT
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { checkout } from "./src/checkout.ts";
try {
  const items = [{ priceCents: 1200, qty: 2 }, { priceCents: 150, qty: 1 }];
  assert.deepEqual(checkout(items, ["SAVE10"]), { subtotal: 2550, discount: 255, tax: 230, total: 2525 }, "tax is charged on the discounted amount");
  assert.deepEqual(checkout(items, ["SAVE10", "SAVE10"]), { subtotal: 2550, discount: 255, tax: 230, total: 2525 }, "a repeated code counts once");
  assert.deepEqual(checkout(items, ["SAVE10", "VIP25", "BOGUS"]), { subtotal: 2550, discount: 893, tax: 166, total: 1823 });
  assert.deepEqual(checkout(items), { subtotal: 2550, discount: 0, tax: 255, total: 2805 });
} catch (e) {
  console.error("hidden check failed: " + String(e.message).replace(/\s*\n\s*/g, " "));
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
