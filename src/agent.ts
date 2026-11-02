import type { LLM, Message, Tool, ToolContext } from "./types.ts";
import { truncate } from "./workspace.ts";
import type { SessionLog } from "./log.ts";

export const SYSTEM_PROMPT = `You are a careful software engineering agent working inside a code repository.
Work in small steps: inspect files before editing, make minimal changes, then verify by running tests.
Use edit_file for targeted changes and write_file only for new files.
All paths are relative to the repository root. When the task is done, call finish with a short summary.`;

export type RunResult = { done: boolean; summary: string; steps: number };

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

    for (const call of reply.toolCalls) {
      const tool = byName.get(call.name);
      let result: string;
      try {
        if (!tool) throw new Error(`Unknown tool: ${call.name}`);
        const args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
        onEvent("tool", `${call.name} ${truncate(call.arguments, 200)}`);
        result = await tool.run(args, ctx);
      } catch (err) {
        result = `ERROR: ${(err as Error).message}`;
      }
      result = truncate(result);
      messages.push({ role: "tool", content: result, toolCallId: call.id, name: call.name });
      log?.write("tool", { name: call.name, args: call.arguments, result });
      if (call.name === "finish" && tool) {
        log?.write("finish", { steps: step, summary: result });
        return { done: true, summary: result, steps: step };
      }
    }
  }
  log?.write("stopped", { reason: "max steps" });
  return { done: false, summary: `Stopped after ${maxSteps} steps without finish.`, steps: maxSteps };
}
