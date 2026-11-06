import type { AssistantMessage, LLM, Message, Tool, ToolCall } from "../types.ts";
import { parseTextToolCalls } from "./textToolCalls.ts";
import { postJson, type RetryOptions, type Sampling } from "./http.ts";

/** Client for any OpenAI-compatible /chat/completions endpoint (Ollama, vLLM, hosted APIs). */
export class OpenAICompatible implements LLM {
  baseUrl: string;
  model: string;
  apiKey: string;
  retry: RetryOptions;
  sampling: Sampling;

  constructor(opts: { baseUrl: string; model: string; apiKey?: string; retry?: RetryOptions; sampling?: Sampling }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.model = opts.model;
    this.apiKey = opts.apiKey ?? "";
    this.retry = opts.retry ?? { timeoutMs: 240_000, retries: 3, backoffMs: 2000 };
    this.sampling = opts.sampling ?? {};
  }

  async chat(messages: Message[], tools: Tool[]): Promise<AssistantMessage> {
    const body = {
      model: this.model,
      messages: messages.map(toWire),
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      // Only sent when set, so provider defaults apply otherwise.
      ...(this.sampling.temperature !== undefined ? { temperature: this.sampling.temperature } : {}),
      ...(this.sampling.seed !== undefined ? { seed: this.sampling.seed } : {}),
      ...(this.sampling.maxTokens !== undefined ? { max_tokens: this.sampling.maxTokens } : {}),
    };
    const data = await postJson(
      `${this.baseUrl}/chat/completions`,
      this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
      body,
      this.retry,
    );
    const msg = data.choices?.[0]?.message ?? {};
    const cutOff = data.choices?.[0]?.finish_reason === "length";
    let parseErrors: string[] = [];
    // Clean first, so JSON inside an invented tool result is never executed.
    let content: string = stripTemplateTokens(msg.content ?? "");
    let toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((c: any, i: number) => ({
      id: c.id ?? `call_${i}`,
      name: c.function.name,
      arguments:
        typeof c.function.arguments === "string"
          ? c.function.arguments
          : JSON.stringify(c.function.arguments ?? {}),
    }));
    if (!toolCalls.length && content) {
      const parsed = parseTextToolCalls(content, tools.map((t) => t.name));
      parseErrors = parsed.failures;
      if (parsed.calls.length) {
        toolCalls = parsed.calls;
        content = parsed.rest;
      }
    }
    if (cutOff && !toolCalls.length) {
      parseErrors.push(
        `the reply was cut off at the ${this.sampling.maxTokens ?? "output"} token limit before a complete tool call; ` +
          "send a shorter call, e.g. edit_file with a small old_str/new_str instead of rewriting a whole file",
      );
    }
    return { role: "assistant", content: content.trim(), toolCalls, ...(parseErrors.length ? { parseErrors } : {}) };
  }
}

/** Remove chat-template control tokens (e.g. <|im_start|>assistant) that some local models leak into text. */
export function stripTemplateTokens(text: string): string {
  return text
    .replace(/<?tool_response>[\s\S]*?(?:<\/tool_response>|$)/g, "") // results the model invented itself
    .replace(/<\|[a-z_]+\|>(?:assistant|user|system)?/g, "")
    .trim();
}

function toWire(m: Message): Record<string, unknown> {
  if (m.role === "tool") return { role: "tool", content: m.content, tool_call_id: m.toolCallId };
  if (m.role === "assistant" && m.toolCalls?.length) {
    return {
      role: "assistant",
      content: m.content || null,
      tool_calls: m.toolCalls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: c.arguments },
      })),
    };
  }
  return { role: m.role, content: m.content };
}
