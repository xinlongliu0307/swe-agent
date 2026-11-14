import { test } from "node:test";
import assert from "node:assert/strict";
import { priceLines } from "../src/services/pricing.ts";

test("priceLines with and without a coupon", () => {
  assert.deepEqual(priceLines([{ sku: "A", qty: 2 }, { sku: "B", qty: 1 }], null), { subtotal: 2899, discount: 0, total: 2899 });
  assert.deepEqual(priceLines([{ sku: "A", qty: 2 }], "TEN"), { subtotal: 2500, discount: 250, total: 2250 });
});

test("unknown skus and coupons are rejected", () => {
  assert.throws(() => priceLines([{ sku: "Z", qty: 1 }], null), /unknown sku/);
  assert.throws(() => priceLines([{ sku: "A", qty: 1 }], "FREE"), /unknown coupon/);
});
