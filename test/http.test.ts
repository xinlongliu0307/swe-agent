import { test } from "node:test";
import assert from "node:assert/strict";
import { postJson } from "../src/llm/http.ts";
import { runAgent } from "../src/agent.ts";
import { defaultTools } from "../src/tools/index.ts";
import os from "node:os";

const fast = { timeoutMs: 1000, retries: 2, backoffMs: 1 };
const ok = () => new Response(JSON.stringify({ ok: true }));

test("retries transient failures, then succeeds", async () => {
  let n = 0;
  const reasons: string[] = [];
  globalThis.fetch = (async () => {
    n++;
    if (n === 1) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
    if (n === 2) return new Response("busy", { status: 503 });
    return ok();
  }) as typeof fetch;
  const data = await postJson("http://x", {}, {}, { ...fast, onRetry: (_a, r) => reasons.push(r) });
  assert.deepEqual(data, { ok: true });
  assert.equal(n, 3);
  assert.match(reasons[0] ?? "", /ECONNRESET/);
  assert.match(reasons[1] ?? "", /HTTP 503/);
});

test("does not retry a client error such as 400", async () => {
  let n = 0;
  globalThis.fetch = (async () => {
    n++;
    return new Response("bad model name", { status: 400 });
  }) as typeof fetch;
  await assert.rejects(postJson("http://x", {}, {}, fast), /after 3 attempt\(s\): HTTP 400: bad model name/);
  assert.equal(n, 1);
});

test("a stalled server times out instead of hanging", async () => {
  // A real socket keeps Node's event loop alive while waiting; the fake needs a timer to do the same.
  globalThis.fetch = ((_u: string, init: RequestInit) =>
    new Promise((_res, rej) => {
      const keepAlive = setTimeout(() => {}, 10_000);
      init.signal?.addEventListener("abort", () => {
        clearTimeout(keepAlive);
        rej(init.signal?.reason);
      });
    })) as typeof fetch;
  const t0 = Date.now();
  await assert.rejects(postJson("http://x", {}, {}, { timeoutMs: 50, retries: 1, backoffMs: 1 }), /no response within 0.05 s/);
  assert.ok(Date.now() - t0 < 2000);
});

test("agent keeps steps and changes when the model becomes unreachable", async () => {
  let n = 0;
  const llm = {
    chat: async () => {
      n++;
      if (n === 1) return { role: "assistant" as const, content: "", toolCalls: [{ id: "a", name: "list_dir", arguments: "{}" }] };
      throw new Error("Model request failed after 4 attempt(s): fetch failed");
    },
  };
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: { workspace: os.tmpdir(), confirm: async () => true } });
  assert.equal(res.done, false);
  assert.equal(res.steps, 1);
  assert.match(res.modelError ?? "", /fetch failed/);
});

test("sampling settings are sent only when set", async () => {
  const { OpenAICompatible } = await import("../src/llm/openai.ts");
  const { samplingFromEnv } = await import("../src/llm/http.ts");
  const bodies: any[] = [];
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: "hi" } }] }));
  }) as typeof fetch;
  await new OpenAICompatible({ baseUrl: "http://x/v1", model: "m" }).chat([], []);
  await new OpenAICompatible({ baseUrl: "http://x/v1", model: "m", sampling: samplingFromEnv({ SWE_TEMPERATURE: "0.3", SWE_SEED: "1001" }) }).chat([], []);
  assert.equal("temperature" in bodies[0], false);
  assert.equal("seed" in bodies[0], false);
  assert.equal(bodies[1].temperature, 0.3);
  assert.equal(bodies[1].seed, 1001);
  assert.deepEqual(samplingFromEnv({ SWE_TEMPERATURE: "", SWE_SEED: undefined }), { temperature: undefined, seed: undefined, maxTokens: 2048 });
});

test("replies are capped by default and a cut-off reply is reported to the agent", async () => {
  const { OpenAICompatible } = await import("../src/llm/openai.ts");
  const { samplingFromEnv, DEFAULT_MAX_TOKENS } = await import("../src/llm/http.ts");
  const { defaultTools } = await import("../src/tools/index.ts");
  let sent: any;
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: '{"name": "write_file", "arguments": {"path": "a.py", "content": "x = 1\\nx = 1\\nx = 1' } }] }));
  }) as typeof fetch;
  const llm = new OpenAICompatible({ baseUrl: "http://x/v1", model: "m", sampling: samplingFromEnv({}) });
  const reply = await llm.chat([], defaultTools);
  assert.equal(sent.max_tokens, DEFAULT_MAX_TOKENS);
  assert.equal(reply.toolCalls?.length, 0);
  assert.ok(reply.parseErrors?.some((e) => /cut off at the 2048 token limit/.test(e)));
});

// ---- 0022: a server that cannot parse the model's tool call ----
const XML_ERROR = JSON.stringify({ error: { message: "XML syntax error on line 3: element <function> closed by </parameter>", type: "api_error" } });

test("a tool-call parse error from the server is not retried", async () => {
  const { ToolCallParseError } = await import("../src/llm/http.ts");
  let n = 0;
  globalThis.fetch = (async () => {
    n++;
    return new Response(XML_ERROR, { status: 500 });
  }) as typeof fetch;
  await assert.rejects(postJson("http://x", {}, {}, fast), (e) => e instanceof ToolCallParseError && /XML syntax error on line 3/.test(e.message));
  assert.equal(n, 1);
});

test("other HTTP 500 errors are still retried", async () => {
  let n = 0;
  globalThis.fetch = (async () => {
    n++;
    return n === 1 ? new Response("model runner crashed", { status: 500 }) : ok();
  }) as typeof fetch;
  assert.deepEqual(await postJson("http://x", {}, {}, fast), { ok: true });
  assert.equal(n, 2);
});

test("the agent asks the model to resend a call the server could not read, and carries on", async () => {
  const { OpenAICompatible } = await import("../src/llm/openai.ts");
  const replies = [
    () => new Response(XML_ERROR, { status: 500 }),
    () => new Response(JSON.stringify({ choices: [{ message: { content: "", tool_calls: [{ id: "f", function: { name: "finish", arguments: '{"summary":"done"}' } }] } }] })),
  ];
  const sent: any[] = [];
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    return replies[sent.length - 1]!();
  }) as typeof fetch;
  const llm = new OpenAICompatible({ baseUrl: "http://x", model: "m", retry: fast });
  const events: string[] = [];
  const res = await runAgent({ task: "t", llm, tools: defaultTools, ctx: { workspace: os.tmpdir(), confirm: async () => true }, finishGuard: false, onEvent: (k, t) => events.push(`${k}:${t}`) });
  assert.equal(res.modelError, undefined);
  assert.equal(res.done, true);
  assert.equal(res.steps, 2);
  const feedback = sent[1].messages.at(-1);
  assert.equal(feedback.role, "user");
  assert.match(feedback.content, /NOT executed: the model server could not read the tool call: XML syntax error/);
  assert.doesNotMatch(feedback.content, /not valid JSON/);
  assert.ok(events.some((e) => e.startsWith("error:UNPARSED TOOL CALL")));
});
