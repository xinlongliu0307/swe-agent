import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTrace } from "../evals/trace.ts";

test("trace shows steps, tool results, guard refusals and the verified flag", () => {
  const log = [
    { event: "task", data: { task: "Fix it" } },
    { event: "assistant", data: { content: "Let me look.", toolCalls: [{ name: "read_file" }] } },
    { event: "tool", data: { name: "read_file", args: '{"path":"a.py"}', result: "    1  x = 1" } },
    { event: "assistant", data: { content: "", toolCalls: [] } },
    { event: "parse_error", data: { errors: ["edit_file: bad JSON"] } },
    { event: "guard", data: { reason: "Run the tests first." } },
    { event: "finish", data: { verified: false, changed: ["a.py"], summary: "done" } },
  ].map((e) => JSON.stringify(e)).join("\n");
  const out = formatTrace(log).join("\n");
  assert.match(out, /^TASK  Fix it/);
  assert.match(out, /#1  SAY \[read_file\] Let me look\./);
  assert.match(out, /read_file \{"path":"a.py"\}  =>  1 x = 1/);
  assert.match(out, /#2  SAY \[-\]/);
  assert.match(out, /UNPARSED  edit_file: bad JSON/);
  assert.match(out, /GUARD  Run the tests first\./);
  assert.match(out, /FINISH  verified=false changed=a.py  done/);
});
