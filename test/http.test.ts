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
