import { test } from "node:test";
import assert from "node:assert/strict";
import { Emitter } from "../src/emitter.ts";

test("on() returns a working unsubscribe", () => {
  const e = new Emitter<number>();
  const seen: number[] = [];
  const stop = e.on((n) => seen.push(n));
  e.emit(1);
  stop();
  e.emit(2);
  assert.deepEqual(seen, [1]);
});
