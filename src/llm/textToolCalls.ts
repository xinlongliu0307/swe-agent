import type { ToolCall } from "../types.ts";

/**
 * Fallback for models that write tool calls as JSON text in `content`
 * instead of the structured `tool_calls` field. Searches anywhere in the
 * text (not just at the start), handles ```json fences and <tool_call> tags,
 * and only accepts names of tools that actually exist.
 */
export function parseTextToolCalls(
  text: string,
  toolNames: string[],
): { calls: ToolCall[]; rest: string } {
  const names = new Set(toolNames);
  const calls: ToolCall[] = [];
  const used: Array<[number, number]> = [];

  for (const [start, end] of topLevelObjects(text)) {
    let value: unknown;
    try {
      value = JSON.parse(text.slice(start, end));
    } catch {
      continue; // braces that are not JSON, e.g. code in prose
    }
    const call = toCall(value, names, calls.length);
    if (call) {
      calls.push(call);
      used.push([start, end]);
    }
  }

  let rest = text;
  for (const [start, end] of used.reverse()) rest = rest.slice(0, start) + rest.slice(end);
  rest = rest
    .replace(/<\/?tool_call>/g, "")
    .replace(/```(?:json)?\s*```/g, "")
    .trim();
  return { calls, rest };
}

function toCall(value: unknown, names: Set<string>, index: number): ToolCall | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  // Accept both {"name", "arguments"} and {"function": {"name", "arguments"}}.
  const fn = (typeof obj.function === "object" && obj.function ? obj.function : obj) as Record<string, unknown>;
  if (typeof fn.name !== "string" || !names.has(fn.name)) return null;
  const args = fn.arguments ?? fn.parameters ?? {};
  return {
    id: `text_call_${index}`,
    name: fn.name,
    arguments: typeof args === "string" ? args : JSON.stringify(args),
  };
}

/** Yield [start, end) spans of top-level {...} blocks, skipping braces inside strings. */
function* topLevelObjects(text: string): Generator<[number, number]> {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"' && depth > 0) inString = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}" && depth > 0) {
      depth--;
      if (depth === 0) yield [start, i + 1];
    }
  }
}
