#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
node --disable-warning=ExperimentalWarning --test test/*.test.ts >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
trap 'rm -f .hidden_check.mjs' EXIT
cat > .hidden_check.mjs <<'EOF'
import assert from "node:assert/strict";
import { field } from "./src/csv.ts";
import { exportUsers } from "./src/export.ts";
try {
  assert.equal(field("Smith, Jane"), '"Smith, Jane"');
  assert.equal(field('VIP "gold"'), '"VIP ""gold"""');
  assert.equal(field("two\nlines"), '"two\nlines"');
  assert.equal(field(undefined), "");
  assert.equal(field(null), "");
  assert.equal(field(0), "0");
  const users = [
    { id: 1, name: "Smith, Jane", email: "j@x.org", note: 'VIP "gold"' },
    { id: 2, name: "Bo", email: "b@x.org" },
  ];
  assert.equal(exportUsers(users, ["email", "name", "note"]), 'email,name,note\r\nj@x.org,"Smith, Jane","VIP ""gold"""\r\nb@x.org,Bo,\r\n');
  assert.equal(exportUsers([], ["id", "name"]), "id,name\r\n", "no users: just the header");
} catch (e) {
  console.error("hidden check failed: " + String(e.message).replace(/\s*\n\s*/g, " "));
  process.exit(1);
}
EOF
node --disable-warning=ExperimentalWarning .hidden_check.mjs
