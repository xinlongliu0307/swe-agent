import { test } from "node:test";
import assert from "node:assert/strict";
import { Editor } from "../src/editor.ts";

test("type and erase", () => {
  const e = new Editor();
  e.type("hello");
  e.erase(2);
  e.type("p!");
  assert.equal(e.text, "help!");
  assert.equal(e.cursor, 5);
});

test("erase stops at the start", () => {
  const e = new Editor();
  e.type("ab");
  e.erase(10);
  assert.equal(e.text, "");
  assert.equal(e.cursor, 0);
});
