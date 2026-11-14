import { test } from "node:test";
import assert from "node:assert/strict";
import { TtlCache } from "../src/store/cache.ts";
import { ManualClock } from "../src/util/clock.ts";

test("entries expire after the ttl", () => {
  const clock = new ManualClock();
  const c = new TtlCache<number>(100, clock);
  c.set("k", 1);
  assert.equal(c.get("k"), 1);
  clock.advance(100);
  assert.equal(c.get("k"), undefined);
});

test("cached values are copies", () => {
  const c = new TtlCache<{ n: number }>(100, new ManualClock());
  const v = { n: 1 };
  c.set("k", v);
  v.n = 2;
  c.get("k")!.n = 3;
  assert.deepEqual(c.get("k"), { n: 1 });
});
