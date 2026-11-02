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
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: ctxFor(ws) });
  assert.equal(res.done, true);
  assert.equal(res.steps, 4);
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
