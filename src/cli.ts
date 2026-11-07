import path from "node:path";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { runAgent } from "./agent.ts";
import { defaultTools } from "./tools/index.ts";
import { SessionLog } from "./log.ts";
import { makeLLM } from "./llm/index.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");
try {
  process.loadEnvFile(path.join(repoRoot, ".env"));
} catch {
  // no .env: rely on the shell environment
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    workspace: { type: "string", short: "w", default: "." },
    "max-steps": { type: "string" },
    yes: { type: "boolean", short: "y", default: false },
    test: { type: "string", short: "t" },
  },
});

const task = positionals.join(" ").trim();
if (!task) {
  console.error('Usage: npm run swe -- [-w <repo>] [-y] [-t "<test command>"] [--max-steps N] "task description"');
  process.exit(2);
}

const workspace = path.resolve(values.workspace!);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const confirm = async (q: string) =>
  values.yes || (await rl.question(`${q}\nAllow? [y/N] `)).trim().toLowerCase() === "y";

const log = new SessionLog(path.join(repoRoot, "runs"), workspace);
let result;
try {
  result = await runAgent({
    task,
    llm: makeLLM(process.env, (attempt, reason) => console.log(`  ~ model call retry ${attempt}: ${reason}`)),
    tools: defaultTools,
    ctx: { workspace, confirm },
    maxSteps: Number(values["max-steps"] ?? process.env.SWE_MAX_STEPS ?? 30),
    log,
    testCommand: values.test ?? (process.env.SWE_TEST_CMD || undefined),
    onEvent: (kind, text) =>
      console.log(
        kind === "tool" ? `  > ${text}`
        : kind === "error" ? `  ! ${text}`
        : kind === "result" ? `    = ${text}`
        : kind === "guard" ? `  ? ${text}`
        : `\n${text}`,
      ),
  });
} catch (err) {
  // Model or network failures: one clear line instead of a stack trace.
  const e = err as Error & { cause?: { code?: string; message?: string } };
  const cause = e.cause?.code ?? e.cause?.message ?? "";
  log.write("error", { message: e.message, cause });
  console.error(`\nModel request failed: ${e.message}${cause ? ` (${cause})` : ""}`);
  console.error(`Check that ${process.env.SWE_BASE_URL ?? "the model endpoint"} is reachable from this machine.`);
  console.error(`log: ${path.relative(process.cwd(), log.file)}`);
  rl.close();
  process.exit(1);
}
rl.close();
console.log(`\n[${result.done ? "done" : result.modelError ? "model error" : "stopped"} after ${result.steps} steps]`);
console.log(`Model summary: ${result.summary}`);
console.log(`Files changed (recorded by the agent): ${result.changed.length ? result.changed.join(", ") : "none"}`);
console.log(`Verified by a passing test run after the last change: ${result.verified ? "yes" : "NO"}`);
console.log(`log: ${path.relative(process.cwd(), log.file)}`);
