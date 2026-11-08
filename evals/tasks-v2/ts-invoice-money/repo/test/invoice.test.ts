import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTotal } from "../src/invoice.ts";

test("total of a single line", () => {
  assert.equal(renderTotal([{ description: "Pen", unitPrice: 19.99, quantity: 1 }]), "Total: $19.99");
});
