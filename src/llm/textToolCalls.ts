import type { ToolCall } from "../types.ts";

/**
 * Fallback for models that write tool calls as JSON text in `content`
 * instead of the structured `tool_calls` field. Searches anywhere in the
 * text (not just at the start), handles ```json fences and <tool_call> tags,
 * and only accepts names of tools that actually exist.
 *
 * Calls that are almost JSON are repaired when the fix is unambiguous (raw
 * newlines or tabs inside strings). Calls that still cannot be read are
 * reported in `failures`, so the agent can tell the model instead of
 * silently ignoring an edit the model believes it made.
 */
export function parseTextToolCalls(
  text: string,
  toolNames: string[],
): { calls: ToolCall[]; rest: string; failures: string[] } {
  const names = new Set(toolNames);
  const calls: ToolCall[] = [];
  const failures: string[] = [];
  const used: Array<[number, number]> = [];

  for (const [start, end] of topLevelObjects(text)) {
    const raw = text.slice(start, end);
    const value = parseLenient(raw);
    if (value === undefined) {
      const name = mentionedTool(raw, names);
      if (name) failures.push(`${name}: ${jsonError(raw)}`);
      continue; // braces that are not JSON, e.g. code in prose
    }
    const call = toCall(value, names, calls.length);
    if (call) {
      calls.push(call);
      used.push([start, end]);
    }
  }

  // A call whose braces never balance (e.g. an unescaped quote) yields no span at all.
  if (!calls.length && !failures.length) {
    const name = mentionedTool(text, names);
    if (name) failures.push(`${name}: the JSON object is incomplete or its quotes are unbalanced`);
  }

  let rest = text;
  for (const [start, end] of used.reverse()) rest = rest.slice(0, start) + rest.slice(end);
  rest = rest
    .replace(/<\/?tool_call>/g, "")
    .replace(/```(?:json)?\s*```/g, "")
    .trim();
  return { calls, rest, failures };
}

/** JSON.parse, then one safe repair: escape raw control characters inside strings. */
function parseLenient(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(escapeControlCharsInStrings(raw));
    } catch {
      return undefined;
    }
  }
}

function jsonError(raw: string): string {
  try {
    JSON.parse(escapeControlCharsInStrings(raw));
    return "unknown JSON error";
  } catch (err) {
    return (err as Error).message;
  }
}

/**
 * Repairs inside JSON strings, both unambiguous:
 * - literal newlines, carriage returns and tabs become \n, \r, \t;
 * - a backslash that does not start a valid JSON escape (e.g. the "\+" of a regex
 *   like /\+/g written into code) is kept as a literal backslash.
 */
export function escapeControlCharsInStrings(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") {
        const next = raw[i + 1] ?? "";
        const validU = next === "u" && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6));
        if (!'"\\/bfnrt'.includes(next) && !validU) {
          out += "\\\\"; // literal backslash
          continue;
        }
        escaped = true;
      }
      else if (c === '"') inString = false;
      else if (c === "\n") { out += "\\n"; continue; }
      else if (c === "\r") { out += "\\r"; continue; }
      else if (c === "\t") { out += "\\t"; continue; }
    } else if (c === '"') inString = true;
    out += c;
  }
  return out;
}

/** The known tool a broken call was aiming at, if the text names one in a "name" field. */
function mentionedTool(text: string, names: Set<string>): string | null {
  for (const m of text.matchAll(/"?name"?\s*:\s*"([a-z_]+)"/g)) {
    if (m[1] && names.has(m[1])) return m[1];
  }
  return null;
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
