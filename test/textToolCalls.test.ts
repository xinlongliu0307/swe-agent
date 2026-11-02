import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTextToolCalls } from "../src/llm/textToolCalls.ts";
import { OpenAICompatible } from "../src/llm/openai.ts";
import { defaultTools } from "../src/tools/index.ts";

const names = defaultTools.map((t) => t.name);

test("bare JSON call in content (observed qwen2.5-coder output)", () => {
  const r = parseTextToolCalls('{"name": "list_dir", "arguments": {"path": "."}}', names);
  assert.deepEqual(r.calls, [{ id: "text_call_0", name: "list_dir", arguments: '{"path":"."}' }]);
  assert.equal(r.rest, "");
});

test("call after prose, inside a json fence", () => {
  const text = 'Let me look first.\n```json\n{"name": "read_file", "arguments": {"path": "calc.py"}}\n```';
  const r = parseTextToolCalls(text, names);
  assert.equal(r.calls[0]?.name, "read_file");
  assert.equal(r.rest, "Let me look first.");
});

test("<tool_call> tags, several calls, function wrapper, string arguments", () => {
  const text =
    '<tool_call>{"name": "list_dir", "arguments": {}}</tool_call>\n' +
    '<tool_call>{"function": {"name": "search", "arguments": "{\\"pattern\\": \\"def mean\\"}"}}</tool_call>';
  const r = parseTextToolCalls(text, names);
  assert.deepEqual(r.calls.map((c) => c.name), ["list_dir", "search"]);
  assert.equal(r.calls[1]?.arguments, '{"pattern": "def mean"}');
});

test("braces inside string arguments do not break parsing", () => {
  const text = '{"name": "write_file", "arguments": {"path": "a.js", "content": "function f() { return \\"}\\"; }"}}';
  const r = parseTextToolCalls(text, names);
  assert.equal(r.calls.length, 1);
  assert.equal(JSON.parse(r.calls[0]!.arguments).content, 'function f() { return "}"; }');
});

test("unknown tool names and non-JSON braces are ignored", () => {
  const r = parseTextToolCalls('Use {x} or {"name": "rm_everything", "arguments": {}}', names);
  assert.equal(r.calls.length, 0);
  assert.equal(r.rest, 'Use {x} or {"name": "rm_everything", "arguments": {}}');
});

test("OpenAI client falls back to text calls when tool_calls is missing", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: '{"name": "list_dir", "arguments": {"path": "."}}' } }],
      }),
    )) as typeof fetch;
  const reply = await new OpenAICompatible({ baseUrl: "http://x/v1", model: "m" }).chat([], defaultTools);
  assert.equal(reply.toolCalls?.[0]?.name, "list_dir");
  assert.equal(reply.content, "");
});

test("chat-template tokens leaked by local models are stripped", async () => {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: '<|im_start|><|im_start|>assistant\n{"name": "list_dir", "arguments": {}}<|im_end|>' } }],
      }),
    )) as typeof fetch;
  const reply = await new OpenAICompatible({ baseUrl: "http://x/v1", model: "m" }).chat([], defaultTools);
  assert.equal(reply.toolCalls?.[0]?.name, "list_dir");
  assert.equal(reply.content, "");
});
