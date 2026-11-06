// Print a readable trace of one agent session log.
//
//   npm run trace -- runs/eval-<stamp>/fix-mean-1        (a run folder)
//   npm run trace -- runs/<stamp>.jsonl                  (a single log file)

import fs from "node:fs";
import path from "node:path";

export function resolveLog(target: string): string {
  if (fs.statSync(target).isFile()) return target;
  const logs = fs.readdirSync(target).filter((f) => f.endsWith(".jsonl")).sort();
  if (!logs.length) throw new Error(`No .jsonl log in ${target}`);
  return path.join(target, logs[logs.length - 1]!);
}

const one = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function formatTrace(jsonl: string): string[] {
  const out: string[] = [];
  let step = 0;
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    const { event, data } = JSON.parse(line) as { event: string; data: any };
    if (event === "task") out.push(`TASK  ${one(data.task, 160)}`);
    else if (event === "assistant") {
      step++;
      const calls = (data.toolCalls ?? []).map((c: any) => c.name).join(", ") || "-";
      out.push(`#${step}  SAY [${calls}] ${one(data.content, 140)}`);
    } else if (event === "tool") out.push(`      ${data.name} ${one(data.args, 100)}  =>  ${one(data.result, 90)}`);
    else if (event === "guard") out.push(`      GUARD  ${one(data.reason, 120)}`);
    else if (event === "parse_error") out.push(`      UNPARSED  ${one((data.errors ?? []).join("; "), 120)}`);
    else if (event === "model_error") out.push(`      MODEL ERROR  ${one(data.modelError, 120)}`);
    else if (event === "finish") out.push(`FINISH  verified=${data.verified} changed=${(data.changed ?? []).join(",") || "none"}  ${one(data.summary, 100)}`);
    else if (event === "stopped") out.push(`STOPPED  ${one(data.reason, 60)}`);
  }
  return out;
}

if (process.argv[1]?.endsWith("trace.ts")) {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: npm run trace -- <run folder or .jsonl file>");
    process.exit(2);
  }
  console.log(formatTrace(fs.readFileSync(resolveLog(target), "utf8")).join("\n"));
}
