import type { AssistantMessage, LLM, Message, Tool } from "../types.ts";
import { postJson, type RetryOptions } from "./http.ts";

/** Client for the Anthropic Messages API, translating to and from the internal format. */
export class Anthropic implements LLM {
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  retry: RetryOptions;

  constructor(opts: { model: string; apiKey: string; baseUrl?: string; maxTokens?: number; retry?: RetryOptions }) {
    this.model = opts.model;
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
    this.maxTokens = opts.maxTokens ?? 8192;
    this.retry = opts.retry ?? { timeoutMs: 240_000, retries: 3, backoffMs: 2000 };
  }

  async chat(messages: Message[], tools: Tool[]): Promise<AssistantMessage> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const data = (await postJson(
      `${this.baseUrl}/v1/messages`,
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      {
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        messages: toWire(messages),
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      },
      this.retry,
    )) as { content: any[] };
    return {
      role: "assistant",
      content: data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n"),
      toolCalls: data.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) })),
    };
  }
}

/** Anthropic wants tool results inside a user turn, and consecutive results merged into one turn. */
function toWire(messages: Message[]): any[] {
  const out: any[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      const block = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content };
      const prev = out.at(-1);
      if (prev?.role === "user" && Array.isArray(prev.content)) prev.content.push(block);
      else out.push({ role: "user", content: [block] });
    } else if (m.role === "assistant") {
      const blocks: any[] = m.content ? [{ type: "text", text: m.content }] : [];
      for (const c of m.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: c.id, name: c.name, input: JSON.parse(c.arguments || "{}") });
      }
      out.push({ role: "assistant", content: blocks });
    } else {
      out.push({ role: "user", content: m.content });
    }
  }
  return out;
}
