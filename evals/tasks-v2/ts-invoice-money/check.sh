#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
trap 'rm -f .hidden_check.mjs' EXIT
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { formatCents, toCents } from "./src/money.ts";
import { totalCents } from "./src/invoice.ts";
try {
  assert.equal(formatCents(123450), "$1,234.50");
  assert.equal(formatCents(100000000), "$1,000,000.00");
  assert.equal(formatCents(-500), "-$5.00");
  assert.equal(formatCents(5), "$0.05");
  assert.equal(toCents(0.29), 29);
  assert.equal(totalCents([{ description: "x", unitPrice: 0.1, quantity: 3 }]), 30);
  assert.equal(totalCents([{ description: "y", unitPrice: 1.15, quantity: 7 }]), 805);
} catch (e) {
  console.error("hidden check failed: " + e.message);
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
