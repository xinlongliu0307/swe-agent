import type { LLM } from "../types.ts";
import { OpenAICompatible } from "./openai.ts";
import { Anthropic } from "./anthropic.ts";

/** Pick a provider from environment variables (see .env.example). */
export function makeLLM(env: NodeJS.ProcessEnv): LLM {
  const provider = env.SWE_PROVIDER ?? "openai";
  if (provider === "openai") {
    return new OpenAICompatible({
      baseUrl: env.SWE_BASE_URL ?? "http://localhost:11434/v1",
      model: env.SWE_MODEL ?? "qwen2.5-coder:14b",
      apiKey: env.SWE_API_KEY,
    });
  }
  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    return new Anthropic({ model: env.SWE_MODEL ?? "claude-sonnet-5-5", apiKey: env.ANTHROPIC_API_KEY });
  }
  throw new Error(`Unknown SWE_PROVIDER: ${provider}`);
}
