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
    call("read_file", { path: "calc.py" }),
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
    call("read_file", { path: "test_calc.py" }),
    call("edit_file", { path: "test_calc.py", old_str: "mean([1, 2, 3]), 2)", new_str: "mean([1, 2, 3]), 3)" }),
    call("finish", { summary: "tests pass" }),
  ]);
  const r = await runTask(fixMean, llm);
  assert.equal(r.solved, false);
  assert.deepEqual(r.changed, []); // the task says not to edit the tests, so the agent refused the edit
  assert.match(r.checkOutput, /visible tests fail/);
});

test("summarise computes pass rate and false claims", () => {
  const base = { steps: 4, toolErrors: 0, guardRefusals: 0, verified: false, modelError: false, changed: [], seconds: 1, checkOutput: "", summary: "", finished: true };
  const s = summarise([
    { ...base, task: "a", rep: 1, solved: true, falseClaim: false },
    { ...base, task: "a", rep: 2, solved: false, falseClaim: true },
  ]);
  assert.equal(s.passRate, 0.5);
  assert.equal(s.falseClaims, 1);
  assert.equal(s.rows[0]?.solved, "1/2");
});

test("preflight reports an unreachable model before any task runs", async () => {
  const { preflight } = await import("../evals/run.ts");
  assert.equal(await preflight(scripted([{ role: "assistant", content: "OK" }])), null);
  const dead: LLM = { chat: async () => { throw new Error("Model request failed after 4 attempt(s): fetch failed (ECONNREFUSED)"); } };
  assert.match((await preflight(dead)) ?? "", /ECONNREFUSED/);
});

test("consecutive model errors are counted from the end", async () => {
  const { consecutiveModelErrors } = await import("../evals/run.ts");
  const r = (modelError: boolean) => ({ modelError }) as Parameters<typeof consecutiveModelErrors>[0][number];
  assert.equal(consecutiveModelErrors([r(true), r(false), r(true), r(true)]), 2);
  assert.equal(consecutiveModelErrors([r(false)]), 0);
});

test("feature-clamp is solvable the way the model tried it (empty old_str = append)", async () => {
  const clamp = "\ndef clamp(x, lo, hi):\n    if lo > hi:\n        raise ValueError('lo > hi')\n    return max(lo, min(x, hi))\n";
  const llm = scripted([
    call("read_file", { path: "util.py" }),
    call("edit_file", { path: "util.py", old_str: "", new_str: clamp }),
    call("run_shell", { command: "python3 -m unittest -q" }),
    call("finish", { summary: "added clamp" }),
  ]);
  const r = await runTask(path.join(TASKS_DIR, "feature-clamp"), llm);
  assert.equal(r.solved, true, r.checkOutput);
  assert.equal(r.verified, true);
});

test("trace feature-median: a test that cannot see median is caught by the agent's own test run", async () => {
  const median = "\ndef median(xs):\n    s = sorted(xs)\n    n = len(s)\n    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2\n";
  const llm = scripted([
    call("read_file", { path: "stats.py" }),
    call("edit_file", { path: "stats.py", old_str: "", new_str: median }),
    call("read_file", { path: "test_stats.py" }),
    call("edit_file", {
      path: "test_stats.py",
      old_str: "        self.assertEqual(mean([1, 2, 3]), 2)\n",
      new_str: "        self.assertEqual(mean([1, 2, 3]), 2)\n\n    def test_median(self):\n        self.assertEqual(median([3, 1, 2]), 2)\n",
    }),
    call("finish", { summary: "added median and a test" }), // median is not imported in the test file
    call("edit_file", { path: "test_stats.py", old_str: "from stats import mean", new_str: "from stats import mean, median" }),
    call("finish", { summary: "added median and a test" }),
  ]);
  const r = await runTask(path.join(TASKS_DIR, "feature-median"), llm, { testCommand: "python3 -m unittest -q" });
  assert.equal(r.solved, true, r.checkOutput);
  assert.equal(r.guardRefusals, 1);
});

// ---- suites v2 and v3: every task is valid and solvable ----
for (const [suite, count] of [["v2", 10], ["v3", 8]] as const) {
  test(`every ${suite} task fails before the agent runs and passes with its reference solution`, async () => {
    const { SUITES } = await import("../evals/run.ts");
    const dir = SUITES[suite]!;
    const names = await fs.readdir(dir);
    assert.equal(names.length, count);
    for (const name of names) {
      const taskDir = path.join(dir, name);
      const work = await prepareWorkdir(taskDir);
      assert.equal((await runCheck(taskDir, work)).ok, false, `${name}: check passes before any change`);
      await fs.cp(path.join(taskDir, "solution"), work, { recursive: true });
      const after = await runCheck(taskDir, work);
      await fs.rm(work, { recursive: true, force: true });
      assert.equal(after.ok, true, `${name}: reference solution fails: ${after.output}`);
    }
  });
}

test("tests are protected only when the task says not to edit them", async () => {
  const { testPathsIfProtected } = await import("../evals/run.ts");
  const p = testPathsIfProtected("Fix it. Do not edit the tests.");
  assert.ok(["tests/test_cart.py", "test_calc.py", "test/api.test.ts"].every((f) => p.some((re) => re.test(f))));
  assert.equal(p.some((re) => re.test("shop/cart.py")), false);
  assert.deepEqual(testPathsIfProtected("Add median and a unit test for it to test_stats.py."), []);
});

test("the agent never sees files left by the pre-run check (e.g. .hidden_check.mjs)", async () => {
  const { SUITES } = await import("../evals/run.ts");
  const os = await import("node:os");
  const logDir = await fs.mkdtemp(path.join(os.tmpdir(), "swe-evallog-"));
  const r = await runTask(path.join(SUITES.v3!, "ts-csv-export"), scripted([call("list_dir", {}), call("finish", { summary: "looked" })]), { logDir });
  assert.equal(r.solved, false);
  const [runDir] = await fs.readdir(logDir);
  const [file] = await fs.readdir(path.join(logDir, runDir!));
  const log = await fs.readFile(path.join(logDir, runDir!, file!), "utf8");
  const listing = log.split("\n").filter(Boolean).map((l) => JSON.parse(l)).find((e) => e.event === "tool" && e.data.name === "list_dir");
  assert.ok(listing, "list_dir ran");
  assert.doesNotMatch(listing.data.result, /hidden_check/);
  await fs.rm(logDir, { recursive: true, force: true });
});
