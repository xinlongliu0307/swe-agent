import { test } from "node:test";
import assert from "node:assert/strict";
import { checkout } from "../src/checkout.ts";
import { resolveCodes } from "../src/discounts.ts";

const items = [{ priceCents: 1200, qty: 2 }, { priceCents: 150, qty: 1 }];

test("checkout without codes", () => {
  assert.deepEqual(checkout(items), { subtotal: 2550, discount: 0, tax: 255, total: 2805 });
});

test("unknown codes are ignored", () => {
  assert.deepEqual(resolveCodes(["NOPE", "SAVE10"]), [10]);
});
