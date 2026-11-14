#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
trap 'rm -f .hidden_check.mjs' EXIT
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { buildIndex, createUser, exportUsers, getUser, listUsers, UserStore, ValidationError } from "./src/index.ts";
import { fromRecord, toRecord } from "./src/store/serialize.ts";
try {
  const noFull = (o, what) => assert.ok(!JSON.stringify(o).includes("fullName"), `${what} must not contain fullName: ${JSON.stringify(o)}`);
  const legacy = { version: 1, id: "old1", fullName: "Grace Hopper", email: "grace@navy.mil", createdAt: "2020-01-01T00:00:00.000Z" };
  assert.deepEqual(fromRecord(legacy), { id: "old1", displayName: "Grace Hopper", email: "grace@navy.mil", createdAt: "2020-01-01T00:00:00.000Z" }, "version 1 records still load");
  assert.deepEqual(toRecord({ id: "n1", displayName: "Bo", email: "bo@x.org", createdAt: "c" }), { version: 2, id: "n1", displayName: "Bo", email: "bo@x.org", createdAt: "c" }, "new records are version 2");
  const store = new UserStore();
  store.load({ old1: JSON.stringify(legacy) });
  const viaLegacy = createUser(store, { fullName: "Old Client", email: "old@x.org" });
  assert.equal(viaLegacy.displayName, "Old Client", "createUser still accepts fullName");
  const both = createUser(store, { fullName: "Old", displayName: "New", email: "n@x.org" });
  assert.equal(both.displayName, "New", "displayName wins when both are sent");
  assert.throws(() => createUser(store, { email: "e@x.org" }), ValidationError, "a name is still required");
  noFull([viaLegacy, both], "createUser results");
  const all = listUsers(store);
  assert.deepEqual(all.map((u) => u.displayName), ["Grace Hopper", "Old Client", "New"]);
  noFull(all, "listUsers");
  noFull(getUser(store, "old1"), "getUser of a version 1 user");
  const saved = JSON.parse(store.dump()[viaLegacy.id]);
  assert.equal(saved.version, 2, "saved records are version 2");
  noFull(saved, "a newly saved record");
  const index = buildIndex(all);
  assert.deepEqual(index.search("grace").map((u) => u.id), ["old1"], "search finds version 1 users by name");
  noFull(index.search("o"), "search results");
  const csv = exportUsers(all);
  assert.ok(csv.startsWith("id,display_name,email\r\n"), "csv header");
  assert.ok(csv.includes("old1,Grace Hopper,grace@navy.mil\r\n"), "csv row of a version 1 user");
} catch (e) {
  console.error("hidden check failed: " + String(e.message).replace(/\s*\n\s*/g, " "));
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
