import { test } from "node:test";
import assert from "node:assert/strict";
import { NotFoundError, readItem, reset, writeItem } from "../src/store.ts";
import { copy, welcome } from "../src/service.ts";

test("readItem resolves with the value", async () => {
  reset();
  assert.equal(await readItem("greeting"), "hello");
});

test("writeItem then readItem", async () => {
  reset();
  await writeItem("k", "v");
  assert.equal(await readItem("k"), "v");
});

test("readItem rejects for a missing key", async () => {
  reset();
  await assert.rejects(readItem("nope"), NotFoundError);
});

test("welcome", async () => {
  reset();
  assert.equal(await welcome(), "hello, world");
});

test("copy", async () => {
  reset();
  await copy("greeting", "g2");
  assert.equal(await readItem("g2"), "hello");
});
