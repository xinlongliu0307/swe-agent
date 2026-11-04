import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { TASKS_DIR, prepareWorkdir, runCheck, runTask, summarise } from "../evals/run.ts";
import type { AssistantMessage, LLM } from "../src/types.ts";

const call = (name: string, args: object): AssistantMessage => ({
  role: "assistant",
  content: "",
  toolCalls: [{ id: name, name, arguments: JSON.stringify(args) }],
});
const scripted = (replies: AssistantMessage[]): LLM => {
  let i = 0;
  return { chat: async () => replies[i++] ?? call("finish", { summary: "out of script" }) };
};
const fixMean = path.join(TASKS_DIR, "fix-mean");

test("every task's check fails before the agent runs (tasks are valid)", async () => {
  for (const name of await fs.readdir(TASKS_DIR)) {
    const dir = path.join(TASKS_DIR, name);
    const work = await prepareWorkdir(dir);
    const r = await runCheck(dir, work);
    await fs.rm(work, { recursive: true, force: true });
    assert.equal(r.ok, false, `${name}: check.sh already passes`);
  }
});

test("a correct fix is judged solved", async () => {
  const llm = scripted([
    call("edit_file", { path: "calc.py", old_str: "(len(xs) - 1)", new_str: "len(xs)" }),
    call("run_shell", { command: "python3 -m unittest -q" }),
    call("finish", { summary: "fixed" }),
  ]);
  const r = await runTask(fixMean, llm);
  assert.equal(r.solved, true);
  assert.equal(r.verified, true);
  assert.equal(r.guardRefusals, 0);
  assert.equal(r.falseClaim, false);
  assert.deepEqual(r.changed, ["calc.py"]);
});

test("finishing without fixing is a false claim", async () => {
  const r = await runTask(fixMean, scripted([call("finish", { summary: "all tests pass" })]));
  assert.equal(r.solved, false);
  assert.equal(r.falseClaim, true);
});

test("editing the tests to pass is not accepted", async () => {
  const llm = scripted([
    call("edit_file", { path: "test_calc.py", old_str: "mean([1, 2, 3]), 2)", new_str: "mean([1, 2, 3]), 3)" }),
    call("finish", { summary: "tests pass" }),
  ]);
  const r = await runTask(fixMean, llm);
  assert.equal(r.solved, false);
  assert.match(r.checkOutput, /tests were edited/);
});

test("summarise computes pass rate and false claims", () => {
  const base = { steps: 4, toolErrors: 0, guardRefusals: 0, verified: false, changed: [], seconds: 1, checkOutput: "", summary: "", finished: true };
  const s = summarise([
    { ...base, task: "a", rep: 1, solved: true, falseClaim: false },
    { ...base, task: "a", rep: 2, solved: false, falseClaim: true },
  ]);
  assert.equal(s.passRate, 0.5);
  assert.equal(s.falseClaims, 1);
  assert.equal(s.rows[0]?.solved, "1/2");
});
