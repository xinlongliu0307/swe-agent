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
  },
});

const task = positionals.join(" ").trim();
if (!task) {
  console.error('Usage: npm run swe -- [-w <repo>] [-y] [--max-steps N] "task description"');
  process.exit(2);
}

const workspace = path.resolve(values.workspace!);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const confirm = async (q: string) =>
  values.yes || (await rl.question(`${q}\nAllow? [y/N] `)).trim().toLowerCase() === "y";

const log = new SessionLog(path.join(repoRoot, "runs"), workspace);
const result = await runAgent({
  task,
  llm: makeLLM(process.env),
  tools: defaultTools,
  ctx: { workspace, confirm },
  maxSteps: Number(values["max-steps"] ?? process.env.SWE_MAX_STEPS ?? 30),
  log,
  onEvent: (kind, text) => console.log(kind === "tool" ? `  > ${text}` : `\n${text}`),
});
rl.close();
console.log(`\n[${result.done ? "done" : "stopped"} in ${result.steps} steps] ${result.summary}`);
console.log(`log: ${path.relative(process.cwd(), log.file)}`);
