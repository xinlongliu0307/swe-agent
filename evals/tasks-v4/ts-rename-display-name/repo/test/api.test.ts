import { test } from "node:test";
import assert from "node:assert/strict";
import { createUser, getUser, renameUser, UserStore, ValidationError } from "../src/index.ts";

test("create and get a user", () => {
  const store = new UserStore();
  const u = createUser(store, { displayName: " Ada Lovelace ", email: "ada@x.org" });
  assert.equal(u.displayName, "Ada Lovelace");
  assert.deepEqual(getUser(store, u.id), u);
});

test("validation", () => {
  assert.throws(() => createUser(new UserStore(), { displayName: "", email: "ada@x.org" }), ValidationError);
  assert.throws(() => createUser(new UserStore(), { displayName: "x".repeat(81), email: "ada@x.org" }), /longer than 80/);
});

test("rename", () => {
  const store = new UserStore();
  const u = createUser(store, { displayName: "Ada", email: "ada@x.org" });
  assert.equal(renameUser(store, u.id, "Countess Ada").displayName, "Countess Ada");
  assert.equal(getUser(store, u.id).displayName, "Countess Ada");
});
