import { test } from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/router.ts";

test("a search URL", () => {
  assert.deepEqual(route("/search?q=sea+ice&page=2"), { path: "/search", query: { q: "sea ice", page: "2" } });
});
