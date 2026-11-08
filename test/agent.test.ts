import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runAgent } from "../src/agent.ts";
import { defaultTools, editFile, editLines, runCheck } from "../src/tools/index.ts";
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

// ---- 0017: indentation-tolerant edits and the requirements review ----
test("edit_file applies an old_str whose indentation differs uniformly, re-indenting new_str", async () => {
  const ws = await tmp();
  await fs.writeFile(path.join(ws, "q.ts"), "export function f(qs: string) {\n  for (const p of qs.split(\"&\")) {\n    const [k, v] = p.split(\"=\");\n    out[k] = v;\n  }\n}\n");
  const res = await editFile.run(
    { path: "q.ts", old_str: "const [k, v] = p.split(\"=\");\nout[k] = v;", new_str: "const i = p.indexOf(\"=\");\nif (i >= 0) {\n  out[p.slice(0, i)] = p.slice(i + 1);\n}" },
    ctxFor(ws),
  );
  assert.match(res, /matched after adjusting its indentation/);
  assert.equal(
    await fs.readFile(path.join(ws, "q.ts"), "utf8"),
    "export function f(qs: string) {\n  for (const p of qs.split(\"&\")) {\n    const i = p.indexOf(\"=\");\n    if (i >= 0) {\n      out[p.slice(0, i)] = p.slice(i + 1);\n    }\n  }\n}\n",
  );
});

test("when old_str does not match at all, the error shows the closest lines to copy", async () => {
  const ws = await tmp();
  await fs.writeFile(path.join(ws, "c.ts"), "export async function getText(url: string) {\n  const res = await fetcher(url);\n  return res.body;\n}\n");
  await assert.rejects(
    editFile.run({ path: "c.ts", old_str: "const response = await fetcher(url, opts);", new_str: "x" }, ctxFor(ws)),
    /closest lines in the file[\s\S]*2 {4}const res = await fetcher\(url\);/,
  );
});

test("review: the first passing finish is turned into a requirements check, the second is accepted", async () => {
  const ws = await sandboxWithTest();
  const events: string[] = [];
  let reviewText = "";
  const replies = [readCalc, fixDouble, call("finish", { summary: "done" }), call("finish", { summary: "done" })];
  let i = 0;
  const llm: LLM = {
    chat: async (messages) => {
      const last = messages.at(-1);
      if (last?.role === "tool" && last.content.startsWith("NOT FINISHED YET")) reviewText = last.content;
      return replies[i++] ?? call("finish", { summary: "x" });
    },
  };
  const res = await runAgent({ task: "Fix double", llm, tools: defaultTools, ctx: ctxFor(ws), testCommand: "python3 -m unittest -q", review: true, onEvent: (k) => events.push(k) });
  assert.equal(events.filter((k) => k === "review").length, 1);
  assert.match(reviewText, /List every requirement/);
  assert.match(reviewText, /Task: Fix double/);
  assert.match(reviewText, /--- calc.py ---\n {3}1 {2}def double\(x\):/);
  assert.equal(res.done, true);
  assert.equal(res.verified, true);
  assert.equal(res.steps, 4);
});

test("review is off by default and skipped when nothing changed", async () => {
  const ws = await sandboxWithTest();
  const events: string[] = [];
  const llm = scripted([readCalc, fixDouble, runTests, call("finish", { summary: "done" })]);
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), onEvent: (k) => events.push(k) });
  assert.equal(events.includes("review"), false);
});

// ---- 0018: replays of the 8 Nov v2 traces ----
test("trace ts-emitter-once-1: a read_file after a failed edit in the same reply still runs", async () => {
  const ws = await sandboxWithTest();
  const results: string[] = [];
  const badEdit = call("edit_file", { path: "calc.py", old_str: "nope", new_str: "x" });
  const llm = scripted([readCalc, both(badEdit, readCalc), call("finish", { summary: "stop" })]);
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), finishGuard: false, onEvent: (k, t) => k === "result" && results.push(t) });
  assert.equal(results.filter((r) => r.includes("def double(x):")).length, 2); // both reads ran
});

test("an identical failed edit on unchanged contents is not run again, and the message says so", async () => {
  const ws = await sandboxWithTest();
  const errors: string[] = [];
  const badEdit = call("edit_file", { path: "calc.py", old_str: "nope", new_str: "x" });
  const llm = scripted([readCalc, badEdit, badEdit, fixDouble, badEdit, call("finish", { summary: "stop" })]);
  await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws), finishGuard: false, onEvent: (k, t) => k === "error" && errors.push(t) });
  assert.match(errors[0] ?? "", /found 0 times/);
  assert.match(errors[1] ?? "", /already made this exact edit_file call at step 2/);
  assert.match(errors[2] ?? "", /found 0 times/); // the file changed in between, so it was tried again
});

test("trace py-rename-function-1: doubled braces in old_str are undone", async () => {
  const ws = await tmp();
  await fs.writeFile(path.join(ws, "views.py"), 'def greeting(user):\n    return f"Hello, {get_user_name(user)}!"\n');
  const res = await editFile.run(
    { path: "views.py", old_str: 'return f"Hello, {{get_user_name(user)}}!"', new_str: 'return f"Hello, {{display_name(user)}}!"' },
    ctxFor(ws),
  );
  assert.match(res, /after undoing doubled braces/);
  assert.equal(await fs.readFile(path.join(ws, "views.py"), "utf8"), 'def greeting(user):\n    return f"Hello, {display_name(user)}!"\n');
});

test("edit_lines replaces, inserts and deletes by line number", async () => {
  const ws = await tmp();
  const f = path.join(ws, "a.txt");
  await fs.writeFile(f, "one\ntwo\nthree\n");
  await editLines.run({ path: "a.txt", start: 2, end: 2, new_text: "TWO\n" }, ctxFor(ws));
  assert.equal(await fs.readFile(f, "utf8"), "one\nTWO\nthree\n");
  await editLines.run({ path: "a.txt", start: 1, end: 0, new_text: "zero" }, ctxFor(ws));
  assert.equal(await fs.readFile(f, "utf8"), "zero\none\nTWO\nthree\n");
  await editLines.run({ path: "a.txt", start: 3, end: 3, new_text: "" }, ctxFor(ws));
  assert.equal(await fs.readFile(f, "utf8"), "zero\none\nthree\n");
  await assert.rejects(editLines.run({ path: "a.txt", start: 9, end: 9, new_text: "x" }, ctxFor(ws)), /invalid line range/);
});

test("run_check runs Python and TypeScript snippets from the repo root and cleans up", async () => {
  const ws = await tmp();
  await fs.mkdir(path.join(ws, "src"));
  await fs.writeFile(path.join(ws, "src", "m.ts"), "export const twice = (n: number): number => n * 2;\n");
  await fs.writeFile(path.join(ws, "calc.py"), "def double(x):\n    return x * 2\n");
  const py = await runCheck.run({ language: "python", code: "from calc import double\nprint('py', double(21))" }, ctxFor(ws));
  const ts = await runCheck.run({ language: "node", code: 'import { twice } from "./src/m.ts";\nconst n: number = twice(21);\nconsole.log("ts", n);' }, ctxFor(ws));
  assert.match(py, /exit code: 0\npy 42/);
  assert.match(ts, /exit code: 0\nts 42/);
  assert.deepEqual((await fs.readdir(ws)).sort(), ["calc.py", "src"]);
});
