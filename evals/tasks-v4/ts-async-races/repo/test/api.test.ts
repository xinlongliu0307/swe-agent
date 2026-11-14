import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiClient, FakeBackend } from "../src/index.ts";

test("users are cached after the first request", async () => {
  const backend = new FakeBackend();
  const api = new ApiClient(backend);
  assert.deepEqual(await api.getUser("u1"), { id: "u1", name: "Ada" });
  await api.getUser("u1");
  assert.equal(backend.userCalls, 1);
});

test("unknown users are rejected", async () => {
  await assert.rejects(new ApiClient(new FakeBackend()).getUser("nobody"), /no user nobody/);
});
