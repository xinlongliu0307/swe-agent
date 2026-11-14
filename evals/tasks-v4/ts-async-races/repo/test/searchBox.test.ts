import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiClient, FakeBackend, SearchBox } from "../src/index.ts";

test("search shows matching users", async () => {
  const box = new SearchBox(new ApiClient(new FakeBackend()));
  await box.search("ad");
  assert.deepEqual(box.results.map((u) => u.name), ["Ada", "Adam"]);
  await box.search("");
  assert.deepEqual(box.results, []);
});
