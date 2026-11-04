import type { LLM, Message, Tool, ToolContext } from "./types.ts";
import { truncate } from "./workspace.ts";
import type { SessionLog } from "./log.ts";

export const SYSTEM_PROMPT = `You are a careful software engineering agent working inside a code repository.
Work in small steps: inspect files before editing, make minimal changes, then verify by running tests.
Use edit_file for targeted changes and write_file only for new files.
All paths are relative to the repository root. When the task is done, call finish with a short summary.
Never write tool results yourself: after making tool calls, stop and wait for the real results.`;

/**
 * `changed` and `verified` are ground truth recorded by the agent, independent of
 * what the model claims. `verified` = finished with a passing test run after the last change.
 */
export type RunResult = {
  done: boolean;
  summary: string;
  steps: number;
  changed: string[];
  verified: boolean;
  modelError?: string; // set when the model could not be reached even after retries
};

/** Shell commands treated as test runs by the finish guard. */
export const TEST_COMMAND =
  /(unittest|pytest|py\.test|\btox\b|\bnox\b|test_\w*\.py|\btests?\/|npm (run )?test|yarn test|pnpm test|node --test|vitest|jest|cargo test|go test|make (test|check)|ctest)/i;

/** How many times finish may be refused before it is accepted as unverified. */
const MAX_REFUSALS = 2;

export async function runAgent(opts: {
  task: string;
  llm: LLM;
  tools: Tool[];
  ctx: ToolContext;
  maxSteps?: number;
  log?: SessionLog;
  onEvent?: (kind: string, text: string) => void;
  /** Refuse finish until tests pass after the last change (default true). */
  finishGuard?: boolean;
}): Promise<RunResult> {
  const { task, llm, tools, ctx, maxSteps = 30, log, onEvent = () => {}, finishGuard = true } = opts;
  const byName = new Map(tools.map((t) => [t.name, t]));
  const changed = new Set<string>();
  // Finish-guard state: did files change since the last test run, and how did that run end?
  let changedSinceTest = false;
  let lastTestExit: number | null = null;
  let refusals = 0;
  const guardReason = (): string | null => {
    if (changedSinceTest)
      return lastTestExit === null
        ? "Files were changed but no tests have been run. Run the project's tests and check they pass, then call finish."
        : "Files were changed after the last test run. Run the tests again and check they pass, then call finish.";
    if (lastTestExit === null)
      return changed.size === 0
        ? "No files were changed and no tests were run. If the task needs code changes, make them and run the tests. If it truly needs none, call finish again."
        : null;
    if (lastTestExit !== 0) return `The latest test run failed (exit code ${lastTestExit}). Fix the failure and re-run the tests before finishing.`;
    return null;
  };
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task },
  ];
  log?.write("task", { task, maxSteps });

  for (let step = 1; step <= maxSteps; step++) {
    let reply;
    try {
      reply = await llm.chat(messages, tools);
    } catch (err) {
      // Keep the work done so far and the step count instead of losing them.
      const modelError = (err as Error).message;
      log?.write("model_error", { step, modelError });
      onEvent("error", `MODEL: ${modelError}`);
      return { done: false, summary: `Model error at step ${step}: ${modelError}`, steps: step - 1, changed: [...changed], verified: false, modelError };
    }
    messages.push(reply);
    log?.write("assistant", reply);
    if (reply.content) onEvent("assistant", reply.content);

    if (!reply.toolCalls?.length) {
      // No tool call: nudge once per step rather than silently stopping.
      messages.push({ role: "user", content: "Continue with a tool call, or call finish if the task is complete." });
      continue;
    }

    const seen = new Set<string>();
    for (const call of reply.toolCalls) {
      const tool = byName.get(call.name);
      let result: string;
      // Local models sometimes repeat the same call in one reply; running it twice
      // makes the second copy fail and confuses the model, so answer it without running.
      const key = `${call.name}\u0000${call.arguments}`;
      if (seen.has(key)) {
        messages.push({ role: "tool", content: "Duplicate call skipped; see the previous result.", toolCallId: call.id, name: call.name });
        continue;
      }
      seen.add(key);
      if (call.name === "finish" && tool && finishGuard && refusals < MAX_REFUSALS) {
        const why = guardReason();
        if (why) {
          refusals++;
          const msg = `FINISH REFUSED: ${why}`;
          onEvent("guard", msg);
          messages.push({ role: "tool", content: msg, toolCallId: call.id, name: call.name });
          log?.write("guard", { reason: why, refusals });
          continue;
        }
      }
      try {
        if (!tool) throw new Error(`Unknown tool: ${call.name}`);
        const args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        onEvent("tool", `${call.name} ${truncate(call.arguments, 200)}`);
        result = await tool.run(args, ctx);
      } catch (err) {
        result = `ERROR: ${(err as Error).message}`;
      }
      if (result.startsWith("ERROR:")) onEvent("error", truncate(result, 300));
      else {
        if (call.name === "write_file" || call.name === "edit_file") {
          const p = (JSON.parse(call.arguments) as { path?: unknown }).path;
          if (typeof p === "string") changed.add(p);
          changedSinceTest = true;
        }
        if (call.name === "run_shell") {
          const command = String((JSON.parse(call.arguments) as { command?: unknown }).command ?? "");
          const exit = /^exit code: (-?\d+)/.exec(result);
          if (exit && TEST_COMMAND.test(command)) {
            lastTestExit = Number(exit[1]);
            changedSinceTest = false;
          }
        }
        if (call.name !== "finish") onEvent("result", preview(result));
      }
      result = truncate(result);
      messages.push({ role: "tool", content: result, toolCallId: call.id, name: call.name });
      log?.write("tool", { name: call.name, args: call.arguments, result });
      if (call.name === "finish" && tool) {
        const verified = guardReason() === null && lastTestExit === 0;
        log?.write("finish", { steps: step, summary: result, changed: [...changed], verified });
        return { done: true, summary: result, steps: step, changed: [...changed], verified };
      }
    }
  }
  log?.write("stopped", { reason: "max steps" });
  return { done: false, summary: `Stopped after ${maxSteps} steps without finish.`, steps: maxSteps, changed: [...changed], verified: false };
}

/** First line of a tool result plus a count of the rest, for the console. */
function preview(result: string): string {
  const lines = result.split("\n");
  const first = (lines[0] ?? "").slice(0, 120);
  return lines.length > 1 ? `${first}  (+${lines.length - 1} more lines)` : first;
}
