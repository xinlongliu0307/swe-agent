import { test } from "node:test";
import assert from "node:assert/strict";
import { field, line } from "../src/csv.ts";

test("plain fields are unchanged", () => {
  assert.equal(field("plain"), "plain");
  assert.equal(field(42), "42");
});

test("a line joins fields with commas", () => {
  assert.equal(line([1, "a"]), "1,a");
});
