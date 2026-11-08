import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import type { Tool } from "../types.ts";
import { resolveInWorkspace, truncate } from "../workspace.ts";

const str = (v: unknown, name: string): string => {
  if (typeof v !== "string") throw new Error(`Argument "${name}" must be a string`);
  return v;
};

/** Run a command with a hard timeout; returns combined stdout/stderr and exit code. */
export function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 60_000,
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    // No .pyc caching: a same-size edit within one second would otherwise run stale bytecode.
    const env = { ...process.env, PYTHONDONTWRITEBYTECODE: "1" };
    const child = spawn(cmd, args, { cwd, env, timeout: timeoutMs, killSignal: "SIGKILL" });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", (e) => resolve({ code: -1, output: String(e) }));
    child.on("close", (code, signal) =>
      resolve({ code, output: signal ? `${output}\n[killed: ${signal}, timeout ${timeoutMs} ms]` : output }),
    );
  });
}

export const readFile: Tool = {
  name: "read_file",
  description: "Read a text file. Returns numbered lines. Optional start/end line (1-based, inclusive).",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path relative to the workspace" },
      start: { type: "number" },
      end: { type: "number" },
    },
    required: ["path"],
  },
  async run(args, ctx) {
    const full = resolveInWorkspace(ctx.workspace, str(args.path, "path"));
    const lines = (await fs.readFile(full, "utf8")).split("\n");
    const start = Math.max(1, Number(args.start ?? 1));
    const end = Math.min(lines.length, Number(args.end ?? lines.length));
    return lines
      .slice(start - 1, end)
      .map((l, i) => `${String(start + i).padStart(5)}  ${l}`)
      .join("\n");
  },
};

export const writeFile: Tool = {
  name: "write_file",
  description: "Create or overwrite a file with the given content.",
  parameters: {
    type: "object",
    properties: { path: { type: "string" }, content: { type: "string" } },
    required: ["path", "content"],
  },
  async run(args, ctx) {
    const full = resolveInWorkspace(ctx.workspace, str(args.path, "path"));
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, str(args.content, "content"));
    return `Wrote ${args.path}`;
  },
};

/** Numbered lines around [startLine, endLine] (1-based), so the model sees the file as it now is. */
export function snippet(text: string, startLine: number, endLine: number, context = 2, maxLines = 30): string {
  const lines = text.split("\n");
  const from = Math.max(1, startLine - context);
  const to = Math.min(lines.length, endLine + context, from + maxLines - 1);
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(`${String(n).padStart(5)}  ${lines[n - 1]}`);
  return out.join("\n");
}

/**
 * Find old_str in text ignoring a uniform indentation difference (e.g. the model used 1 space
 * where the file uses 4). Returns the exact text found and the indentation shift, or null.
 * Only accepts a single match whose lines differ by the same indentation offset throughout.
 */
export function findIndentShifted(text: string, oldStr: string): { found: string; add: string; remove: string } | null {
  const fileLines = text.split("\n");
  const oldLines = oldStr.replace(/\n+$/, "").split("\n");
  const firstReal = oldLines.findIndex((l) => l.trim() !== "");
  if (firstReal < 0) return null;
  const lead = (l: string) => /^[ \t]*/.exec(l)![0];
  const matches: Array<{ start: number; add: string; remove: string }> = [];
  for (let s = 0; s + oldLines.length <= fileLines.length; s++) {
    let ok = true;
    let add = "";
    let remove = "";
    for (let j = 0; j < oldLines.length && ok; j++) {
      const f = fileLines[s + j]!;
      const o = oldLines[j]!;
      if (f.trim() !== o.trim()) ok = false;
      else if (o.trim() !== "") {
        const fl = lead(f);
        const ol = lead(o);
        const a = fl.length >= ol.length && fl.endsWith(ol) ? fl.slice(0, fl.length - ol.length) : null;
        const r = ol.length > fl.length && ol.endsWith(fl) ? ol.slice(0, ol.length - fl.length) : null;
        const [thisAdd, thisRemove] = a !== null ? [a, ""] : r !== null ? ["", r] : [null, null];
        if (thisAdd === null || thisRemove === null) ok = false;
        else if (j === firstReal) [add, remove] = [thisAdd, thisRemove];
        else if (thisAdd !== add || thisRemove !== remove) ok = false; // not a uniform shift
      }
    }
    if (ok) matches.push({ start: s, add, remove });
  }
  if (matches.length !== 1) return null;
  const m = matches[0]!;
  return { found: fileLines.slice(m.start, m.start + oldLines.length).join("\n"), add: m.add, remove: m.remove };
}

/**
 * Systematic slips models make when copying code into old_str: doubled braces (a template habit,
 * "{{x}}" for "{x}") and escaped quotes left in ("\\"" for "\""). Each is applied to old_str and
 * new_str together and only used if the result matches the file exactly once.
 */
const COPY_SLIPS: Array<{ label: string; fix: (s: string) => string }> = [
  { label: "doubled braces", fix: (s) => s.replace(/\{\{/g, "{").replace(/\}\}/g, "}") },
  { label: "escaped quotes", fix: (s) => s.replace(/\\"/g, '"').replace(/\\'/g, "'") },
];

/** Re-indent new_str by the same shift found for old_str. */
function shiftIndent(newStr: string, add: string, remove: string): string {
  return newStr
    .split("\n")
    .map((l) => (l.trim() === "" ? l : add + (remove && l.startsWith(remove) ? l.slice(remove.length) : l)))
    .join("\n");
}

/** The file lines most like old_str's first line, to show when nothing matched. */
function closestLines(text: string, oldStr: string): string {
  const first = oldStr.split("\n").find((l) => l.trim() !== "")?.trim() ?? "";
  const lines = text.split("\n");
  const words = first.split(/\W+/).filter((w) => w.length > 2);
  let best = -1;
  let bestScore = 0;
  lines.forEach((l, i) => {
    const score = words.filter((w) => l.includes(w)).length;
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  if (best < 0) return "";
  const n = Math.max(1, oldStr.split("\n").length);
  return `\nThe closest lines in the file are (copy old_str from here exactly, including indentation):\n${snippet(text, best + 1, best + n, 1, 12)}`;
}

export const editFile: Tool = {
  name: "edit_file",
  description:
    "Replace an exact snippet in a file. old_str must occur exactly once. " +
    "To add code at the end of a file, use an empty old_str. Returns the edited lines.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string" },
      old_str: { type: "string" },
      new_str: { type: "string" },
    },
    required: ["path", "old_str", "new_str"],
  },
  async run(args, ctx) {
    const full = resolveInWorkspace(ctx.workspace, str(args.path, "path"));
    const oldStr = str(args.old_str, "old_str");
    const text = await fs.readFile(full, "utf8");
    if (oldStr === "") {
      // Append: the natural reading of an empty old_str, and what models try when adding a function.
      const sep = text === "" || text.endsWith("\n") ? "" : "\n";
      const updated = text + sep + str(args.new_str, "new_str");
      await fs.writeFile(full, updated);
      const start = (text + sep).split("\n").length;
      return `Appended to ${args.path}. The end of the file now reads:\n${snippet(updated, start, updated.split("\n").length, 0)}`;
    }
    const count = text.split(oldStr).length - 1;
    const newStr = str(args.new_str, "new_str");
    // Only for a meaningful snippet: a short new_str like "x" matches by chance.
    if (count === 0 && newStr.trim().length >= 10 && text.includes(newStr)) {
      throw new Error(`old_str not found in ${args.path}, but new_str is already present: the edit looks already applied. Re-read the file before editing again.`);
    }
    if (count === 0) {
      for (const slip of COPY_SLIPS) {
        const o = slip.fix(oldStr);
        if (o === oldStr || text.split(o).length - 1 !== 1) continue;
        const n = slip.fix(newStr);
        const updated = text.replace(o, () => n);
        await fs.writeFile(full, updated);
        const startLine = text.slice(0, text.indexOf(o)).split("\n").length;
        return `Edited ${args.path} (old_str matched after undoing ${slip.label}; the same fix was applied to new_str). Around the change it now reads:\n${snippet(updated, startLine, startLine + n.split("\n").length - 1)}`;
      }
      const shifted = findIndentShifted(text, oldStr);
      if (shifted) {
        const fixedNew = shiftIndent(newStr.replace(/\n+$/, ""), shifted.add, shifted.remove);
        const updated = text.replace(shifted.found, () => fixedNew);
        await fs.writeFile(full, updated);
        const startLine = text.slice(0, text.indexOf(shifted.found)).split("\n").length;
        const endLine = startLine + fixedNew.split("\n").length - 1;
        return `Edited ${args.path} (old_str matched after adjusting its indentation to the file's). Around the change it now reads:\n${snippet(updated, startLine, endLine)}`;
      }
      throw new Error(
        `old_str found 0 times in ${args.path}; it must match the file exactly.${closestLines(text, oldStr)}\n` +
          "If copying the text exactly keeps failing, use edit_lines with the line numbers shown by read_file.",
      );
    }
    if (count !== 1) throw new Error(`old_str found ${count} times in ${args.path}; it must be unique. Include more surrounding lines.`);
    const updated = text.replace(oldStr, () => newStr);
    await fs.writeFile(full, updated);
    const startLine = text.slice(0, text.indexOf(oldStr)).split("\n").length;
    const endLine = startLine + newStr.split("\n").length - 1;
    return `Edited ${args.path}. Around the change it now reads:\n${snippet(updated, startLine, endLine)}`;
  },
};

export const editLines: Tool = {
  name: "edit_lines",
  description:
    "Replace lines start..end (1-based, inclusive, as numbered by read_file) with new_text. " +
    "Use end = start - 1 to insert before line start, and an empty new_text to delete. Returns the edited lines.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string" },
      start: { type: "number" },
      end: { type: "number" },
      new_text: { type: "string" },
    },
    required: ["path", "start", "end", "new_text"],
  },
  async run(args, ctx) {
    const full = resolveInWorkspace(ctx.workspace, str(args.path, "path"));
    const text = await fs.readFile(full, "utf8");
    const lines = text.split("\n");
    const start = Number(args.start);
    const end = Number(args.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || start > lines.length + 1 || end < start - 1 || end > lines.length) {
      throw new Error(`invalid line range ${args.start}-${args.end}; ${args.path} has ${lines.length} lines`);
    }
    const newText = str(args.new_text, "new_text").replace(/\n$/, "");
    const inserted = newText === "" ? [] : newText.split("\n");
    lines.splice(start - 1, end - start + 1, ...inserted);
    const updated = lines.join("\n");
    await fs.writeFile(full, updated);
    const last = Math.max(start, start + inserted.length - 1);
    return `Edited ${args.path}: lines ${start}-${end} replaced by ${inserted.length} line(s). Around the change it now reads:\n${snippet(updated, start, last)}`;
  },
};

export const runCheck: Tool = {
  name: "run_check",
  description:
    "Run a short Python or Node/TypeScript script from the repository root to check a behaviour, without shell quoting. " +
    'language: "python" or "node". In node code, import project files with relative paths such as "./src/file.ts".',
  parameters: {
    type: "object",
    properties: { language: { type: "string" }, code: { type: "string" } },
    required: ["language", "code"],
  },
  async run(args, ctx) {
    const language = str(args.language, "language").toLowerCase();
    const node = ["node", "typescript", "ts", "javascript", "js"].includes(language);
    if (!node && language !== "python") throw new Error('language must be "python" or "node"');
    const file = node ? ".swe_check.mts" : ".swe_check.py";
    const full = resolveInWorkspace(ctx.workspace, file);
    if (!(await ctx.confirm(`Run check script (${language}):\n${truncate(str(args.code, "code"), 600)}`))) return "User declined to run this check.";
    await fs.writeFile(full, str(args.code, "code"));
    try {
      const { code, output } = node
        ? await runCommand("node", ["--disable-warning=ExperimentalWarning", file], ctx.workspace)
        : await runCommand("python3", [file], ctx.workspace);
      return truncate(`exit code: ${code}\n${output}`);
    } finally {
      await fs.rm(full, { force: true });
    }
  },
};

export const listDir: Tool = {
  name: "list_dir",
  description: "List files and folders at a path (default: workspace root).",
  parameters: { type: "object", properties: { path: { type: "string" } } },
  async run(args, ctx) {
    const full = resolveInWorkspace(ctx.workspace, typeof args.path === "string" ? args.path : ".");
    const entries = await fs.readdir(full, { withFileTypes: true });
    return entries
      .filter((e) => e.name !== ".git" && e.name !== "node_modules")
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort()
      .join("\n");
  },
};

export const search: Tool = {
  name: "search",
  description: "Search file contents with a regular expression (grep -E). Returns file:line:text.",
  parameters: {
    type: "object",
    properties: { pattern: { type: "string" }, path: { type: "string" } },
    required: ["pattern"],
  },
  async run(args, ctx) {
    const target = resolveInWorkspace(ctx.workspace, typeof args.path === "string" ? args.path : ".");
    const { output } = await runCommand(
      "grep",
      ["-rnIE", "--exclude-dir=.git", "--exclude-dir=node_modules", "-e", str(args.pattern, "pattern"), target],
      ctx.workspace,
      30_000,
    );
    const rel = output.split(ctx.workspace + path.sep).join("");
    return truncate(rel.trim() || "No matches.", 8_000);
  },
};

export const runShell: Tool = {
  name: "run_shell",
  description: "Run a bash command in the workspace (60 s timeout). Use for tests, git status, builds.",
  parameters: {
    type: "object",
    properties: { command: { type: "string" } },
    required: ["command"],
  },
  async run(args, ctx) {
    const command = str(args.command, "command");
    if (!(await ctx.confirm(`Run: ${command}`))) return "User declined to run this command.";
    const { code, output } = await runCommand("bash", ["-c", command], ctx.workspace);
    return truncate(`exit code: ${code}\n${output}`);
  },
};

export const finish: Tool = {
  name: "finish",
  description: "Call when the task is complete. Give a short summary of what changed.",
  parameters: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  async run(args) {
    return str(args.summary, "summary");
  },
};

export const defaultTools: Tool[] = [readFile, writeFile, editFile, editLines, listDir, search, runShell, runCheck, finish];
