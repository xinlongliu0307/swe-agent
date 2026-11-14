import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex } from "../src/index.ts";

test("prefix search over names and emails", () => {
  const users = [
    { id: "1", displayName: "Ada Lovelace", email: "ada@x.org", createdAt: "" },
    { id: "2", displayName: "Alan Turing", email: "alan@y.org", createdAt: "" },
  ];
  const index = buildIndex(users);
  assert.deepEqual(index.search("a").map((u) => u.id), ["1", "2"]);
  assert.deepEqual(index.search("love").map((u) => u.id), ["1"]);
  assert.deepEqual(index.search("y.org").map((u) => u.id), ["2"]);
});
