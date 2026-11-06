import fs from "node:fs";
import path from "node:path";
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
  /** Refuse edits to existing files not read in an earlier step (default true). */
  readBeforeEdit?: boolean;
}): Promise<RunResult> {
  const { task, llm, tools, ctx, maxSteps = 30, log, onEvent = () => {}, finishGuard = true, readBeforeEdit = true } = opts;
  // Files whose current contents the model has seen in an earlier step (read, written or edited).
  const known = new Set<string>();
  const norm = (p: unknown) => (typeof p === "string" ? path.normalize(p) : "");
  // Set when an edit or write fails, cleared when one succeeds.
  let lastEditError: string | null = null;
  const byName = new Map(tools.map((t) => [t.name, t]));
  const changed = new Set<string>();
  // Finish-guard state: did files change since the last test run, and how did that run end?
  let changedSinceTest = false;
  let lastTestExit: number | null = null;
  let refusals = 0;
  const guardReason = (): string | null => {
    if (lastEditError && changed.size === 0)
      return `Your last edit did not apply (${truncate(lastEditError, 160)}), so no file has been changed. Fix the edit, run the tests, then call finish.`;
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
      if (reply.parseErrors?.length) {
        // The model tried to call a tool but the call was not valid JSON. Say so plainly;
        // otherwise it assumes the edit happened and blames the environment.
        const detail = reply.parseErrors.join("; ");
        onEvent("error", `UNPARSED TOOL CALL: ${truncate(detail, 200)}`);
        log?.write("parse_error", { errors: reply.parseErrors });
        messages.push({ role: "user", content: unparsedCallMessage(detail) });
        continue;
      }
      // No tool call: nudge once per step rather than silently stopping.
      messages.push({ role: "user", content: "Continue with a tool call, or call finish if the task is complete." });
      continue;
    }

    const seen = new Set<string>();
    const seenThisReply: string[] = []; // files read in this reply only become "known" after it
    let failedCall: string | null = null;
    for (const call of reply.toolCalls) {
      // Calls after a failure were planned assuming it succeeded (e.g. run tests after an edit
      // that did not apply), so they are not run.
      if (failedCall) {
        const msg = `Not run: an earlier call in this reply (${failedCall}) failed. Read its error, then decide the next step.`;
        messages.push({ role: "tool", content: msg, toolCallId: call.id, name: call.name });
        log?.write("skipped", { name: call.name, args: call.arguments, after: failedCall });
        continue;
      }
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
        if (readBeforeEdit && (call.name === "edit_file" || call.name === "write_file") && !known.has(norm(args.path))) {
          const exists = typeof args.path === "string" && fs.existsSync(path.resolve(ctx.workspace, args.path));
          if (exists)
            throw new Error(
              `${call.name} refused: read ${args.path} with read_file first, in a separate step, so the change is based on its actual contents.`,
            );
        }
        result = await tool.run(args, ctx);
      } catch (err) {
        result = `ERROR: ${(err as Error).message}`;
      }
      const isEdit = call.name === "write_file" || call.name === "edit_file";
      if (result.startsWith("ERROR:")) {
        onEvent("error", truncate(result, 300));
        if (isEdit) lastEditError = result.slice(7);
        if (call.name !== "finish") failedCall = call.name;
      } else {
        const p = (JSON.parse(call.arguments || "{}") as { path?: unknown }).path;
        if (isEdit) {
          if (typeof p === "string") changed.add(p);
          changedSinceTest = true;
          lastEditError = null;
          known.add(norm(p)); // the write or the returned snippet shows the new contents
        }
        if (call.name === "read_file") seenThisReply.push(norm(p));
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
        // Verified only if something changed and the tests passed after the last change.
        const verified = changed.size > 0 && !changedSinceTest && lastTestExit === 0;
        log?.write("finish", { steps: step, summary: result, changed: [...changed], verified });
        return { done: true, summary: result, steps: step, changed: [...changed], verified };
      }
    }
    for (const p of seenThisReply) known.add(p);
  }
  log?.write("stopped", { reason: "max steps" });
  return { done: false, summary: `Stopped after ${maxSteps} steps without finish.`, steps: maxSteps, changed: [...changed], verified: false };
}

export function unparsedCallMessage(detail: string): string {
  return [
    `Your last tool call was NOT executed: it is not valid JSON (${detail}). No file was changed.`,
    'Send the call again as one JSON object: {"name": "<tool>", "arguments": {...}}.',
    'Inside JSON strings, escape double quotes as \\" and newlines as \\n. For example: {"name": "edit_file", "arguments": {"path": "a.py", "old_str": "x.split(\\",\\")", "new_str": "[f.strip() for f in x.split(\\",\\")]"}}',
  ].join("\n");
}

/** First line of a tool result plus a count of the rest, for the console. */
function preview(result: string): string {
  const lines = result.split("\n");
  const first = (lines[0] ?? "").slice(0, 120);
  return lines.length > 1 ? `${first}  (+${lines.length - 1} more lines)` : first;
}
