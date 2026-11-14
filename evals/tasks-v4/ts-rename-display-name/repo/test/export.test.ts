import { test } from "node:test";
import assert from "node:assert/strict";
import { exportUsers } from "../src/index.ts";

test("csv export", () => {
  const csv = exportUsers([{ id: "1", displayName: "Lovelace, Ada", email: "ada@x.org", createdAt: "" }]);
  assert.equal(csv, 'id,display_name,email\r\n1,"Lovelace, Ada",ada@x.org\r\n');
});
