import { test } from "node:test";
import assert from "node:assert/strict";
import { fromRecord, toRecord } from "../src/store/serialize.ts";

test("records round-trip", () => {
  const user = { id: "u9", displayName: "Bo", email: "bo@x.org", createdAt: "2026-01-01T00:00:00.000Z" };
  assert.deepEqual(fromRecord(toRecord(user)), user);
});
