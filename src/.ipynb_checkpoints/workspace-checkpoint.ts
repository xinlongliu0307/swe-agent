import path from "node:path";
import os from "node:os";

/** Resolve a model-supplied path and refuse anything outside the workspace. */
export function resolveInWorkspace(workspace: string, p: string): string {
  const root = path.resolve(workspace);
  const full = path.resolve(root, p);
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return full;
}

/** Strip machine-specific prefixes before anything is written to a log. */
export function redact(text: string, workspace: string): string {
  const root = path.resolve(workspace);
  return text.split(root).join("<ws>").split(os.homedir()).join("~");
}

/** Keep tool output small enough for the context window. */
export function truncate(text: string, max = 12_000): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max / 2);
  const tail = text.slice(-max / 2);
  return `${head}\n... [${text.length - max} chars truncated] ...\n${tail}`;
}
