// Eval harness: runs the agent on each task in a throwaway copy and judges the
// result only by the task's own check.sh, never by what the model claims.
//
//   npm run eval                          all tasks once
//   npm run eval -- --tasks fix-mean,fix-temperature --repeat 3
//   npm run eval -- --max-steps 15 --keep  (keep work dirs for inspection)

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { runAgent, type RunResult } from "../src/agent.ts";
import { defaultTools, runCommand } from "../src/tools/index.ts";
import { SessionLog } from "../src/log.ts";
import { makeLLM } from "../src/llm/index.ts";
import type { LLM } from "../src/types.ts";

export const TASKS_DIR = path.join(import.meta.dirname, "tasks");

export type EvalRecord = {
  task: string;
  rep: number;
  solved: boolean; // check.sh exited 0 after the run
  finished: boolean; // the model called finish
  falseClaim: boolean; // called finish, but the check failed
  steps: number;
  toolErrors: number;
  changed: string[];
  seconds: number;
  checkOutput: string;
  summary: string;
  invalid?: string; // set when the task itself is broken
};

const git = (cwd: string, ...args: string[]) =>
  runCommand("git", ["-c", "user.name=eval", "-c", "user.email=eval@example.com", ...args], cwd);

/** Copy repo/ into a fresh git repo in a temp dir. */
export async function prepareWorkdir(taskDir: string): Promise<string> {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), `swe-eval-${path.basename(taskDir)}-`));
  await fs.cp(path.join(taskDir, "repo"), work, { recursive: true });
  await git(work, "init", "-q");
  await git(work, "add", "-A");
  await git(work, "commit", "-qm", "init");
  return work;
}

export async function runCheck(taskDir: string, work: string): Promise<{ ok: boolean; output: string }> {
  const { code, output } = await runCommand("bash", [path.join(taskDir, "check.sh")], work, 120_000);
  return { ok: code === 0, output: output.trim().split("\n").slice(-3).join(" | ") };
}

export async function runTask(
  taskDir: string,
  llm: LLM,
  opts: { rep?: number; maxSteps?: number; logDir?: string; keep?: boolean } = {},
): Promise<EvalRecord> {
  const task = path.basename(taskDir);
  const rep = opts.rep ?? 1;
  const work = await prepareWorkdir(taskDir);
  const base = { task, rep, finished: false, falseClaim: false, steps: 0, toolErrors: 0, changed: [], seconds: 0, summary: "" };
  try {
    const before = await runCheck(taskDir, work);
    if (before.ok) return { ...base, solved: false, checkOutput: "", invalid: "check.sh passes before the agent runs" };

    const instruction = (await fs.readFile(path.join(taskDir, "task.md"), "utf8")).trim();
    const log = opts.logDir ? new SessionLog(path.join(opts.logDir, `${task}-${rep}`), work) : undefined;
    let toolErrors = 0;
    const start = Date.now();
    let res: RunResult;
    try {
      res = await runAgent({
        task: instruction,
        llm,
        tools: defaultTools,
        ctx: { workspace: work, confirm: async () => true }, // throwaway copy: auto-approve
        maxSteps: opts.maxSteps ?? 20,
        log,
        onEvent: (kind) => {
          if (kind === "error") toolErrors++;
        },
      });
    } catch (err) {
      res = { done: false, summary: `model error: ${(err as Error).message}`, steps: 0, changed: [] };
    }
    const seconds = Math.round((Date.now() - start) / 1000);
    const after = await runCheck(taskDir, work);
    return {
      task,
      rep,
      solved: after.ok,
      finished: res.done,
      falseClaim: res.done && !after.ok,
      steps: res.steps,
      toolErrors,
      changed: res.changed,
      seconds,
      checkOutput: after.output,
      summary: res.summary.slice(0, 200),
    };
  } finally {
    if (!opts.keep) await fs.rm(work, { recursive: true, force: true });
  }
}

export function summarise(records: EvalRecord[]) {
  const valid = records.filter((r) => !r.invalid);
  const solved = valid.filter((r) => r.solved).length;
  const byTask = new Map<string, EvalRecord[]>();
  for (const r of valid) byTask.set(r.task, [...(byTask.get(r.task) ?? []), r]);
  const rows = [...byTask].map(([task, rs]) => ({
    task,
    solved: `${rs.filter((r) => r.solved).length}/${rs.length}`,
    meanSteps: +(rs.reduce((s, r) => s + r.steps, 0) / rs.length).toFixed(1),
    toolErrors: rs.reduce((s, r) => s + r.toolErrors, 0),
    falseClaims: rs.filter((r) => r.falseClaim).length,
  }));
  return {
    runs: valid.length,
    solved,
    passRate: valid.length ? +(solved / valid.length).toFixed(3) : 0,
    falseClaims: valid.filter((r) => r.falseClaim).length,
    invalidTasks: [...new Set(records.filter((r) => r.invalid).map((r) => r.task))],
    rows,
  };
}

async function main() {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  try {
    process.loadEnvFile(path.join(repoRoot, ".env"));
  } catch {
    // no .env
  }
  const { values } = parseArgs({
    options: {
      tasks: { type: "string" },
      repeat: { type: "string", default: "1" },
      "max-steps": { type: "string", default: "20" },
      keep: { type: "boolean", default: false },
    },
  });
  const all = (await fs.readdir(TASKS_DIR)).sort();
  const names = values.tasks ? values.tasks.split(",").map((s) => s.trim()) : all;
  const unknown = names.filter((n) => !all.includes(n));
  if (unknown.length) throw new Error(`Unknown task(s): ${unknown.join(", ")}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = path.join(repoRoot, "runs", `eval-${stamp}`);
  const llm = makeLLM(process.env);
  const repeat = Number(values.repeat);
  const records: EvalRecord[] = [];

  for (const name of names) {
    for (let rep = 1; rep <= repeat; rep++) {
      process.stdout.write(`${name} #${rep} ... `);
      const r = await runTask(path.join(TASKS_DIR, name), llm, {
        rep,
        maxSteps: Number(values["max-steps"]),
        logDir,
        keep: values.keep,
      });
      records.push(r);
      console.log(
        r.invalid
          ? `INVALID (${r.invalid})`
          : `${r.solved ? "PASS" : "FAIL"}  steps=${r.steps} errors=${r.toolErrors} ${r.seconds}s${r.falseClaim ? "  FALSE CLAIM" : ""}`,
      );
    }
  }

  const summary = summarise(records);
  console.log("");
  console.table(summary.rows);
  console.log(
    `Solved ${summary.solved}/${summary.runs} (${(summary.passRate * 100).toFixed(0)}%), false claims: ${summary.falseClaims}` +
      (summary.invalidTasks.length ? `, invalid tasks: ${summary.invalidTasks.join(", ")}` : ""),
  );
  const report = path.join(repoRoot, "runs", `eval-${stamp}.json`);
  await fs.mkdir(path.dirname(report), { recursive: true });
  await fs.writeFile(
    report,
    JSON.stringify({ model: process.env.SWE_MODEL, provider: process.env.SWE_PROVIDER, repeat, summary, records }, null, 2),
  );
  console.log(`report: ${path.relative(process.cwd(), report)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
