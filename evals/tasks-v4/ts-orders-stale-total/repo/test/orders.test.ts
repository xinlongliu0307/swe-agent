import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.ts";
import { ManualClock } from "../src/util/clock.ts";

test("create and read an order", () => {
  const app = createApp(new ManualClock());
  const created = app.handle("POST", "/orders", { lines: [{ sku: "A", qty: 2 }], coupon: "TEN" });
  assert.equal(created.status, 201);
  const { id, totalCents } = created.body as { id: string; totalCents: number };
  assert.equal(totalCents, 2250);
  const got = app.handle("GET", `/orders/${id}`);
  assert.deepEqual([got.status, (got.body as { total: string }).total], [200, "AUD 22.50"]);
});

test("reads are served from the cache", () => {
  const app = createApp(new ManualClock());
  const { id } = app.handle("POST", "/orders", { lines: [{ sku: "B", qty: 1 }] }).body as { id: string };
  const before = app.store.reads;
  app.handle("GET", `/orders/${id}`);
  app.handle("GET", `/orders/${id}`);
  assert.equal(app.store.reads - before, 1);
});

test("unknown orders are 404", () => {
  assert.equal(createApp().handle("GET", "/orders/nope").status, 404);
});
