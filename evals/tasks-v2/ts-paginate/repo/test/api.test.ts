import { test } from "node:test";
import assert from "node:assert/strict";
import { listUsers } from "../src/api.ts";

test("the last page", () => {
  assert.deepEqual(listUsers({ page: "3" }).items, ["user21", "user22", "user23"]);
});
