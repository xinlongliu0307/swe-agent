import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runAgent } from "../src/agent.ts";
import { defaultTools, editFile } from "../src/tools/index.ts";
import { resolveInWorkspace, redact } from "../src/workspace.ts";
import type { AssistantMessage, LLM, ToolContext } from "../src/types.ts";

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), "swe-test-"));
const ctxFor = (workspace: string): ToolContext => ({ workspace, confirm: async () => true });

/** A scripted fake model: returns the given replies in order. */
function scripted(replies: AssistantMessage[]): LLM {
  let i = 0;
  return { chat: async () => replies[i++] ?? { role: "assistant", content: "out of script" } };
}

const call = (name: string, args: object, id = name): AssistantMessage => ({
  role: "assistant",
  content: "",
  toolCalls: [{ id, name, arguments: JSON.stringify(args) }],
});

test("path guard blocks escapes", () => {
  assert.throws(() => resolveInWorkspace("/repo", "../etc/passwd"));
  assert.throws(() => resolveInWorkspace("/repo", "/etc/passwd"));
  assert.equal(resolveInWorkspace("/repo", "src/a.ts"), "/repo/src/a.ts");
});

test("redact removes workspace and home paths", () => {
  const out = redact(`/repo/x and ${os.homedir()}/y`, "/repo");
  assert.equal(out, "<ws>/x and ~/y");
});

test("edit_file requires a unique match", async () => {
  const ws = await tmp();
  await fs.writeFile(path.join(ws, "a.txt"), "x x");
  await assert.rejects(editFile.run({ path: "a.txt", old_str: "x", new_str: "y" }, ctxFor(ws)));
});

test("agent loop writes, edits, runs shell, then finishes", async () => {
  const ws = await tmp();
  const llm = scripted([
    call("write_file", { path: "hello.py", content: "print('hi')\n" }),
    call("edit_file", { path: "hello.py", old_str: "hi", new_str: "hello" }),
    call("run_shell", { command: "cat hello.py" }),
    call("finish", { summary: "created hello.py" }),
  ]);
  // cat is not a test run, so this loop test turns the finish guard off.
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), finishGuard: false });
  assert.equal(res.done, true);
  assert.equal(res.steps, 4);
  assert.deepEqual(res.changed, ["hello.py"]); // recorded by the agent, not claimed by the model
  assert.equal(await fs.readFile(path.join(ws, "hello.py"), "utf8"), "print('hello')\n");
});

test("tool errors are returned to the model, not thrown", async () => {
  const ws = await tmp();
  const seen: string[] = [];
  const llm: LLM = {
    chat: async (messages) => {
      const last = messages.at(-1);
      if (last?.role === "tool") seen.push(last.content);
      return seen.length ? call("finish", { summary: "ok" }) : call("read_file", { path: "missing.txt" });
    },
  };
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws) });
  assert.match(seen[0] ?? "", /^ERROR:/);
});

test("stops at maxSteps", async () => {
  const ws = await tmp();
  const llm: LLM = { chat: async () => call("list_dir", {}) };
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), maxSteps: 3 });
  assert.equal(res.done, false);
});

test("tool errors are surfaced to the console via onEvent", async () => {
  const ws = await tmp();
  await fs.writeFile(path.join(ws, "calc.py"), "def mean(xs):\n    return 0\n");
  const events: string[] = [];
  const llm = scripted([
    call("read_file", { path: "calc.py" }),
    call("edit_file", { path: "calc.py", old_str: "def mean(numbers):", new_str: "x" }),
    call("finish", { summary: "ok" }),
  ]);
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), onEvent: (k, t) => events.push(`${k}:${t}`) });
  assert.ok(events.some((e) => e.startsWith("error:ERROR: old_str found 0 times")));
});

test("identical calls in one reply run once (observed duplicate edit_file)", async () => {
  const ws = await tmp();
  await fs.writeFile(path.join(ws, "calc.py"), "def mean(xs):\n    return sum(xs) / (len(xs) - 1)\n");
  const edit = { id: "e", name: "edit_file", arguments: JSON.stringify({ path: "calc.py", old_str: "(len(xs) - 1)", new_str: "len(xs)" }) };
  const errors: string[] = [];
  const llm = scripted([
    call("read_file", { path: "calc.py" }),
    { role: "assistant", content: "", toolCalls: [edit, { ...edit, id: "e2" }] },
    call("finish", { summary: "ok" }),
  ]);
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), onEvent: (k, t) => k === "error" && errors.push(t) });
  assert.deepEqual(errors, []);
  assert.equal(await fs.readFile(path.join(ws, "calc.py"), "utf8"), "def mean(xs):\n    return sum(xs) / len(xs)\n");
});

test("edit_file says when an edit is already applied", async () => {
  const ws = await tmp();
  await fs.writeFile(path.join(ws, "calc.py"), "    return sum(xs) / len(xs)\n");
  await assert.rejects(
    editFile.run({ path: "calc.py", old_str: "(len(xs) - 1)", new_str: "sum(xs) / len(xs)" }, ctxFor(ws)),
    /already applied/,
  );
});

test("failed edits are not recorded as changes", async () => {
  const ws = await tmp();
  await fs.writeFile(path.join(ws, "a.txt"), "abc");
  const llm = scripted([call("edit_file", { path: "a.txt", old_str: "zzz", new_str: "y" }), call("finish", { summary: "changed a.txt" })]);
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws) });
  assert.deepEqual(res.changed, []);
});

// ---- finish guard ----
const sandboxWithTest = async () => {
  const ws = await tmp();
  await fs.writeFile(path.join(ws, "calc.py"), "def double(x):\n    return x * 3\n");
  await fs.writeFile(
    path.join(ws, "test_calc.py"),
    "import unittest\nfrom calc import double\n\nclass T(unittest.TestCase):\n    def test_double(self):\n        self.assertEqual(double(2), 4)\n\nif __name__ == '__main__':\n    unittest.main()\n",
  );
  return ws;
};
const fixDouble = call("edit_file", { path: "calc.py", old_str: "x * 3", new_str: "x * 2" });
const readCalc = call("read_file", { path: "calc.py" });
const runTests = call("run_shell", { command: "python3 -m unittest -q" });

test("guard refuses finish after an edit with no test run, then accepts once tests pass", async () => {
  const ws = await sandboxWithTest();
  const guard: string[] = [];
  const llm = scripted([readCalc, fixDouble, call("finish", { summary: "done" }), runTests, call("finish", { summary: "done" })]);
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), onEvent: (k, t) => k === "guard" && guard.push(t) });
  assert.equal(guard.length, 1);
  assert.match(guard[0] ?? "", /no tests have been run/);
  assert.equal(res.done, true);
  assert.equal(res.verified, true);
});

test("guard refuses finish when the latest test run failed", async () => {
  const ws = await sandboxWithTest();
  const guard: string[] = [];
  const llm = scripted([readCalc, runTests, call("finish", { summary: "done" }), fixDouble, runTests, call("finish", { summary: "done" })]);
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), onEvent: (k, t) => k === "guard" && guard.push(t) });
  assert.match(guard[0] ?? "", /latest test run failed \(exit code 1\)/);
  assert.equal(res.verified, true);
});

test("non-test shell commands do not count as verification", async () => {
  const ws = await sandboxWithTest();
  const guard: string[] = [];
  const llm = scripted([readCalc, fixDouble, call("run_shell", { command: "cat calc.py" }), call("finish", { summary: "done" }), runTests, call("finish", { summary: "done" })]);
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), onEvent: (k, t) => k === "guard" && guard.push(t) });
  assert.equal(guard.length, 1);
});

test("after repeated refusals finish is accepted but marked unverified", async () => {
  const ws = await sandboxWithTest();
  const llm = scripted([readCalc, fixDouble, call("finish", { summary: "a" }), call("finish", { summary: "b" }), call("finish", { summary: "c" })]);
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws) });
  assert.equal(res.done, true);
  assert.equal(res.steps, 5);
  assert.equal(res.verified, false);
});

test("an unparsable tool call gets specific feedback, not the generic nudge", async () => {
  const ws = await tmp();
  const errors: string[] = [];
  let feedback = "";
  let n = 0;
  const llm: LLM = {
    chat: async (messages) => {
      n++;
      if (n === 1) return { role: "assistant", content: "", toolCalls: [], parseErrors: ["edit_file: Unexpected token"] };
      const last = messages.at(-1);
      if (last?.role === "user") feedback = last.content;
      return call("finish", { summary: "stop" });
    },
  };
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), finishGuard: false, onEvent: (k, t) => k === "error" && errors.push(t) });
  assert.match(errors[0] ?? "", /UNPARSED TOOL CALL: edit_file/);
  assert.match(feedback, /NOT executed/);
  assert.match(feedback, /No file was changed/);
});

// ---- safer editing: replays of the 7 Nov traces ----
const both = (...calls: AssistantMessage[]): AssistantMessage => ({
  role: "assistant",
  content: "",
  toolCalls: calls.flatMap((c) => c.toolCalls ?? []).map((c, i) => ({ ...c, id: `${c.id}-${i}` })),
});

test("trace fix-mean-1: an edit planned in the same reply as the read is refused", async () => {
  const ws = await sandboxWithTest();
  const errors: string[] = [];
  const llm = scripted([both(readCalc, call("edit_file", { path: "calc.py", old_str: "def mean(numbers):", new_str: "x" })), fixDouble, runTests, call("finish", { summary: "ok" })]);
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), onEvent: (k, t) => k === "error" && errors.push(t) });
  assert.match(errors[0] ?? "", /read calc\.py with read_file first, in a separate step/);
  assert.equal(res.verified, true);
});

test("trace feature-clamp: empty old_str appends, and tests then pass for real", async () => {
  const ws = await sandboxWithTest();
  const results: string[] = [];
  const addTriple = call("edit_file", { path: "calc.py", old_str: "", new_str: "\ndef triple(x):\n    return x * 3\n" });
  const llm = scripted([readCalc, addTriple, call("finish", { summary: "ok" })]);
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), finishGuard: false, onEvent: (k, t) => k === "result" && results.push(t) });
  const text = await fs.readFile(path.join(ws, "calc.py"), "utf8");
  assert.equal(text, "def double(x):\n    return x * 3\n\ndef triple(x):\n    return x * 3\n");
  assert.ok(results.some((r) => r.startsWith("Appended to calc.py")));
});

test("calls after a failed call in the same reply are not run, and finish is refused", async () => {
  const ws = await sandboxWithTest();
  const guard: string[] = [];
  const badEdit = call("edit_file", { path: "calc.py", old_str: "x", new_str: "y" }); // "x" occurs 3 times
  const llm = scripted([readCalc, both(badEdit, runTests), call("finish", { summary: "added" }), call("finish", { summary: "added" }), call("finish", { summary: "added" })]);
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), onEvent: (k, t) => k === "guard" && guard.push(t) });
  assert.match(guard[0] ?? "", /last edit did not apply .* no file has been changed/);
  assert.deepEqual(res.changed, []);
  assert.equal(res.verified, false); // nothing changed, so nothing was verified
});

test("edit_file returns the edited lines; new files need no prior read", async () => {
  const ws = await sandboxWithTest();
  const results: string[] = [];
  const llm = scripted([
    call("write_file", { path: "new.py", content: "a = 1\n" }),
    readCalc,
    fixDouble,
    call("finish", { summary: "ok" }),
  ]);
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), finishGuard: false, onEvent: (k, t) => k === "result" && results.push(t) });
  assert.ok(results.includes("Wrote new.py"));
  assert.ok(results.some((r) => r.startsWith("Edited calc.py. Around the change it now reads:")));
});

// ---- the agent runs the project's own tests at finish ----
test("with a test command, finish is checked by running the real tests", async () => {
  const ws = await sandboxWithTest();
  const guard: string[] = [];
  let taskText = "";
  const wrongFix = call("edit_file", { path: "calc.py", old_str: "x * 3", new_str: "x * 4" });
  const fixAgain = call("edit_file", { path: "calc.py", old_str: "x * 4", new_str: "x * 2" });
  const replies = [readCalc, wrongFix, call("run_shell", { command: "python3 calc.py" }), call("finish", { summary: "fixed" }), fixAgain, call("finish", { summary: "fixed" })];
  let i = 0;
  const llm: LLM = {
    chat: async (messages) => {
      if (i === 0) taskText = messages[1]?.content ?? "";
      return replies[i++] ?? call("finish", { summary: "x" });
    },
  };
  const res = await runAgent({ task: "Fix double", llm, tools: defaultTools, ctx: ctxFor(ws), testCommand: "python3 -m unittest -q", onEvent: (k, t) => k === "guard" && guard.push(t) });
  assert.match(taskText, /tests run with: python3 -m unittest -q/);
  assert.equal(guard.length, 1);
  assert.match(guard[0] ?? "", /fail when the agent runs them \(exit code 1\)/);
  assert.match(guard[0] ?? "", /AssertionError: 8 != 4/); // the real failure output is shown
  assert.equal(res.verified, true);
});
