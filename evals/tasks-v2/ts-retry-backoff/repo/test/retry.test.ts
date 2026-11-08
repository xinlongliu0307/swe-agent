import { test } from "node:test";
import assert from "node:assert/strict";
import { retry } from "../src/retry.ts";

test("succeeds after two failures", async () => {
  let calls = 0;
  const value = await retry(async () => {
    calls++;
    if (calls < 3) throw new Error("flaky");
    return "ok";
  }, { retries: 3, baseMs: 1 });
  assert.equal(value, "ok");
  assert.equal(calls, 3);
});
