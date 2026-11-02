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
    const child = spawn(cmd, args, { cwd, timeout: timeoutMs, killSignal: "SIGKILL" });
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

export const editFile: Tool = {
  name: "edit_file",
  description: "Replace an exact snippet in a file. old_str must occur exactly once.",
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
    const count = text.split(oldStr).length - 1;
    if (count !== 1) throw new Error(`old_str found ${count} times in ${args.path}; it must be unique`);
    await fs.writeFile(full, text.replace(oldStr, () => str(args.new_str, "new_str")));
    return `Edited ${args.path}`;
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

export const defaultTools: Tool[] = [readFile, writeFile, editFile, listDir, search, runShell, finish];
