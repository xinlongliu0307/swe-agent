import type { AssistantMessage, LLM, Message, Tool } from "../types.ts";

/** Client for any OpenAI-compatible /chat/completions endpoint (Ollama, vLLM, hosted APIs). */
export class OpenAICompatible implements LLM {
  baseUrl: string;
  model: string;
  apiKey: string;

  constructor(opts: { baseUrl: string; model: string; apiKey?: string }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.model = opts.model;
    this.apiKey = opts.apiKey ?? "";
  }

  async chat(messages: Message[], tools: Tool[]): Promise<AssistantMessage> {
    const body = {
      model: this.model,
      messages: messages.map(toWire),
      tools: tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    };
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as any;
    const msg = data.choices?.[0]?.message ?? {};
    return {
      role: "assistant",
      content: msg.content ?? "",
      toolCalls: (msg.tool_calls ?? []).map((c: any, i: number) => ({
        id: c.id ?? `call_${i}`,
        name: c.function.name,
        arguments:
          typeof c.function.arguments === "string"
            ? c.function.arguments
            : JSON.stringify(c.function.arguments ?? {}),
      })),
    };
  }
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
