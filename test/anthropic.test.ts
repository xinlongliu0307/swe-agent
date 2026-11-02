import { test } from "node:test";
import assert from "node:assert/strict";
import { Anthropic } from "../src/llm/anthropic.ts";
import type { Message } from "../src/types.ts";

test("anthropic client merges tool results and parses tool_use", async () => {
  let sent: any;
  globalThis.fetch = (async (_url: string, init: any) => {
    sent = JSON.parse(init.body);
    return new Response(
      JSON.stringify({ content: [{ type: "text", text: "ok" }, { type: "tool_use", id: "t9", name: "finish", input: { summary: "s" } }] }),
    );
  }) as typeof fetch;
  const msgs: Message[] = [
    { role: "system", content: "sys" },
    { role: "user", content: "task" },
    { role: "assistant", content: "", toolCalls: [{ id: "a", name: "list_dir", arguments: "{}" }, { id: "b", name: "list_dir", arguments: "{}" }] },
    { role: "tool", content: "x", toolCallId: "a", name: "list_dir" },
    { role: "tool", content: "y", toolCallId: "b", name: "list_dir" },
  ];
  const reply = await new Anthropic({ model: "m", apiKey: "k" }).chat(msgs, []);
  assert.equal(sent.system, "sys");
  assert.equal(sent.messages.length, 3);
  assert.equal(sent.messages[2].content.length, 2);
  assert.deepEqual(reply.toolCalls, [{ id: "t9", name: "finish", arguments: '{"summary":"s"}' }]);
});
