import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiClient, FakeBackend, renderUserCard } from "../src/index.ts";

test("a user card", async () => {
  assert.equal(await renderUserCard(new ApiClient(new FakeBackend()), "u4"), "[u4] Bo");
});
