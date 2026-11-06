// Shared message and tool types. The internal format follows the
// OpenAI chat schema; other providers translate to and from it.

export type ToolCall = {
  id: string;
  name: string;
  arguments: string; // raw JSON string as produced by the model
};

export type Message =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[]; parseErrors?: string[] }
  | { role: "tool"; content: string; toolCallId: string; name: string };

export type AssistantMessage = Extract<Message, { role: "assistant" }>;

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
};

export type ToolContext = {
  workspace: string;
  confirm: (question: string) => Promise<boolean>;
};

export type Tool = {
  name: string;
  description: string;
  parameters: JsonSchema;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
};

export interface LLM {
  chat(messages: Message[], tools: Tool[]): Promise<AssistantMessage>;
}
