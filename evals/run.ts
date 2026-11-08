// Eval harness: runs the agent on each task in a throwaway copy and judges the
// result only by the task's own check.sh, never by what the model claims.
//
//   npm run eval                          all tasks once
//   npm run eval -- --tasks fix-mean,fix-temperature --repeat 3
//   npm run eval -- --max-steps 15 --keep  (keep work dirs for inspection)
//   npm run eval -- --suite v2 --repeat 3  (multi-file Python and TypeScript tasks)
//
// Sampling is fixed by default so that two versions of the agent face the same
// randomness: temperature 0.3 and seed = base seed + repeat number. Use
// --temperature default to fall back to the provider's own settings.

import fsp from "node:fs/promises";
import fs from "node:fs";
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

/** v1: ten small single-file Python tasks. v2: ten multi-file Python and TypeScript tasks. */
export const SUITES: Record<string, string> = {
  v1: TASKS_DIR,
  v2: path.join(import.meta.dirname, "tasks-v2"),
};

/** The visible test suite of every task; a task folder may override it with a test_cmd file. */
export const DEFAULT_TEST_COMMAND = "python3 -m unittest -q";

export function taskTestCommand(taskDir: string, fallback: string): string {
  try {
    return fs.readFileSync(path.join(taskDir, "test_cmd"), "utf8").trim() || fallback;
  } catch {
    return fallback;
  }
}

export type EvalRecord = {
  task: string;
  rep: number;
  solved: boolean; // check.sh exited 0 after the run
  finished: boolean; // the model called finish
  falseClaim: boolean; // called finish, but the check failed
  modelError: boolean; // the model was unreachable; an infrastructure failure, not an agent one
  steps: number;
  toolErrors: number;
  guardRefusals: number; // finish attempts the guard refused
  verified: boolean; // agent saw passing tests after its last change
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
  const work = await fsp.mkdtemp(path.join(os.tmpdir(), `swe-eval-${path.basename(taskDir)}-`));
  await fsp.cp(path.join(taskDir, "repo"), work, { recursive: true });
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
  opts: { rep?: number; maxSteps?: number; logDir?: string; keep?: boolean; testCommand?: string; review?: boolean } = {},
): Promise<EvalRecord> {
  const task = path.basename(taskDir);
  const rep = opts.rep ?? 1;
  const work = await prepareWorkdir(taskDir);
  const base = { task, rep, finished: false, falseClaim: false, modelError: false, steps: 0, toolErrors: 0, guardRefusals: 0, verified: false, changed: [], seconds: 0, summary: "" };
  try {
    const before = await runCheck(taskDir, work);
    if (before.ok) return { ...base, solved: false, checkOutput: "", invalid: "check.sh passes before the agent runs" };

    const instruction = (await fsp.readFile(path.join(taskDir, "task.md"), "utf8")).trim();
    const log = opts.logDir ? new SessionLog(path.join(opts.logDir, `${task}-${rep}`), work) : undefined;
    let toolErrors = 0;
    let guardRefusals = 0;
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
        testCommand: opts.testCommand,
        review: opts.review ?? false,
        onEvent: (kind) => {
          if (kind === "error") toolErrors++;
          if (kind === "guard") guardRefusals++;
        },
      });
    } catch (err) {
      res = { done: false, summary: `model error: ${(err as Error).message}`, steps: 0, changed: [], verified: false, modelError: String(err) };
    }
    const seconds = Math.round((Date.now() - start) / 1000);
    const after = await runCheck(taskDir, work);
    return {
      task,
      rep,
      solved: after.ok,
      finished: res.done,
      falseClaim: res.done && !after.ok,
      modelError: Boolean(res.modelError),
      steps: res.steps,
      toolErrors,
      guardRefusals,
      verified: res.verified,
      changed: res.changed,
      seconds,
      checkOutput: after.output,
      summary: res.summary.slice(0, 200),
    };
  } finally {
    if (!opts.keep) await fsp.rm(work, { recursive: true, force: true });
  }
}

/** Stop the whole eval after this many model errors in a row: the endpoint is down, not the agent. */
export const MAX_CONSECUTIVE_MODEL_ERRORS = 3;

export function consecutiveModelErrors(records: EvalRecord[]): number {
  let n = 0;
  for (let i = records.length - 1; i >= 0 && records[i]?.modelError; i--) n++;
  return n;
}

/** One tiny model call before any task runs, so a dead endpoint fails in seconds, not after every task. */
export async function preflight(llm: LLM): Promise<string | null> {
  try {
    await llm.chat([{ role: "user", content: "Reply with the single word OK." }], []);
    return null;
  } catch (err) {
    return (err as Error).message;
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
    refusals: rs.reduce((s, r) => s + r.guardRefusals, 0),
    falseClaims: rs.filter((r) => r.falseClaim).length,
  }));
  return {
    runs: valid.length,
    solved,
    passRate: valid.length ? +(solved / valid.length).toFixed(3) : 0,
    falseClaims: valid.filter((r) => r.falseClaim).length,
    modelErrors: valid.filter((r) => r.modelError).length,
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
      temperature: { type: "string", default: "0.3" },
      seed: { type: "string", default: "1000" },
      "test-cmd": { type: "string", default: DEFAULT_TEST_COMMAND },
      "no-agent-tests": { type: "boolean", default: false },
      suite: { type: "string", default: "v1" },
      "no-review": { type: "boolean", default: false },
    },
  });
  const suiteDir = SUITES[values.suite!];
  if (!suiteDir) throw new Error(`Unknown suite: ${values.suite} (choose ${Object.keys(SUITES).join(", ")})`);
  const all = (await fsp.readdir(suiteDir)).sort();
  const names = values.tasks ? values.tasks.split(",").map((s) => s.trim()) : all;
  const unknown = names.filter((n) => !all.includes(n));
  if (unknown.length) throw new Error(`Unknown task(s): ${unknown.join(", ")}`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = path.join(repoRoot, "runs", `eval-${stamp}`);
  const onRetry = (attempt: number, reason: string) => process.stdout.write(`[retry ${attempt}: ${reason}] `);
  const fixed = values.temperature !== "default";
  const sampling = fixed ? { temperature: Number(values.temperature), baseSeed: Number(values.seed) } : null;
  // One client per repeat: repeat r always uses seed baseSeed + r, so runs are comparable across versions.
  const llmFor = (rep: number) =>
    makeLLM(
      fixed ? { ...process.env, SWE_TEMPERATURE: String(sampling!.temperature), SWE_SEED: String(sampling!.baseSeed + rep) } : process.env,
      onRetry,
    );
  const llm = llmFor(1);
  const repeat = Number(values.repeat);
  console.log(`Suite: ${values.suite} (${names.length} tasks), requirements review: ${values["no-review"] ? "off" : "on"}`);
  console.log(fixed ? `Sampling: temperature ${sampling!.temperature}, seeds ${sampling!.baseSeed + 1}..${sampling!.baseSeed + repeat}` : "Sampling: provider defaults (not reproducible)");
  const records: EvalRecord[] = [];

  process.stdout.write("Checking the model endpoint ... ");
  const down = await preflight(llm);
  if (down) {
    console.error(`\nModel unreachable: ${down}`);
    console.error(`Check that ${process.env.SWE_BASE_URL ?? "the model endpoint"} answers from this machine. No tasks were run.`);
    process.exit(1);
  }
  console.log("ok\n");

  let aborted = false;
  outer: for (const name of names) {
    for (let rep = 1; rep <= repeat; rep++) {
      process.stdout.write(`${name} #${rep} ... `);
      const taskDir = path.join(suiteDir, name);
      const r = await runTask(taskDir, llmFor(rep), {
        testCommand: values["no-agent-tests"] ? undefined : taskTestCommand(taskDir, values["test-cmd"]!),
        review: !values["no-review"],
        rep,
        maxSteps: Number(values["max-steps"]),
        logDir,
        keep: values.keep,
      });
      records.push(r);
      console.log(
        r.invalid
          ? `INVALID (${r.invalid})`
          : `${r.solved ? "PASS" : "FAIL"}${r.modelError ? " (MODEL ERROR)" : ""}  steps=${r.steps} errors=${r.toolErrors} refused=${r.guardRefusals} ${r.seconds}s${r.falseClaim ? "  FALSE CLAIM" : ""}`,
      );
      if (consecutiveModelErrors(records) >= MAX_CONSECUTIVE_MODEL_ERRORS) {
        console.error(`\nStopping: ${MAX_CONSECUTIVE_MODEL_ERRORS} model errors in a row. The endpoint went away; results so far are saved but are not a fair measurement.`);
        aborted = true;
        break outer;
      }
    }
  }

  const summary = summarise(records);
  console.log("");
  console.table(summary.rows);
  console.log(
    `Solved ${summary.solved}/${summary.runs} (${(summary.passRate * 100).toFixed(0)}%), false claims: ${summary.falseClaims}, model errors: ${summary.modelErrors}` +
      (summary.invalidTasks.length ? `, invalid tasks: ${summary.invalidTasks.join(", ")}` : ""),
  );
  const report = path.join(repoRoot, "runs", `eval-${stamp}.json`);
  await fsp.mkdir(path.dirname(report), { recursive: true });
  await fsp.writeFile(
    report,
    JSON.stringify({ model: process.env.SWE_MODEL, provider: process.env.SWE_PROVIDER, suite: values.suite, review: !values["no-review"], repeat, sampling, agentTests: !values["no-agent-tests"], aborted, summary, records }, null, 2),
  );
  console.log(`report: ${path.relative(process.cwd(), report)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
