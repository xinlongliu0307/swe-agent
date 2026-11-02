import type { LLM, Message, Tool, ToolContext } from "./types.ts";
import { truncate } from "./workspace.ts";
import type { SessionLog } from "./log.ts";

export const SYSTEM_PROMPT = `You are a careful software engineering agent working inside a code repository.
Work in small steps: inspect files before editing, make minimal changes, then verify by running tests.
Use edit_file for targeted changes and write_file only for new files.
All paths are relative to the repository root. When the task is done, call finish with a short summary.
Never write tool results yourself: after making tool calls, stop and wait for the real results.`;

/** `changed` is ground truth recorded by the agent, independent of what the model claims. */
export type RunResult = { done: boolean; summary: string; steps: number; changed: string[] };

export async function runAgent(opts: {
  task: string;
  llm: LLM;
  tools: Tool[];
  ctx: ToolContext;
  maxSteps?: number;
  log?: SessionLog;
  onEvent?: (kind: string, text: string) => void;
}): Promise<RunResult> {
  const { task, llm, tools, ctx, maxSteps = 30, log, onEvent = () => {} } = opts;
  const byName = new Map(tools.map((t) => [t.name, t]));
  const changed = new Set<string>();
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task },
  ];
  log?.write("task", { task, maxSteps });

  for (let step = 1; step <= maxSteps; step++) {
    const reply = await llm.chat(messages, tools);
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
        }
        if (call.name !== "finish") onEvent("result", preview(result));
      }
      result = truncate(result);
      messages.push({ role: "tool", content: result, toolCallId: call.id, name: call.name });
      log?.write("tool", { name: call.name, args: call.arguments, result });
      if (call.name === "finish" && tool) {
        log?.write("finish", { steps: step, summary: result, changed: [...changed] });
        return { done: true, summary: result, steps: step, changed: [...changed] };
      }
    }
  }
  log?.write("stopped", { reason: "max steps" });
  return { done: false, summary: `Stopped after ${maxSteps} steps without finish.`, steps: maxSteps, changed: [...changed] };
}

/** First line of a tool result plus a count of the rest, for the console. */
function preview(result: string): string {
  const lines = result.split("\n");
  const first = (lines[0] ?? "").slice(0, 120);
  return lines.length > 1 ? `${first}  (+${lines.length - 1} more lines)` : first;
}
