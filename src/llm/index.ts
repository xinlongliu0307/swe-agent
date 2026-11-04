import type { LLM } from "../types.ts";
import { OpenAICompatible } from "./openai.ts";
import { Anthropic } from "./anthropic.ts";
import { retryOptionsFromEnv } from "./http.ts";

/** Pick a provider from environment variables (see .env.example). */
export function makeLLM(env: NodeJS.ProcessEnv, onRetry?: (attempt: number, reason: string) => void): LLM {
  const provider = env.SWE_PROVIDER ?? "openai";
  const retry = { ...retryOptionsFromEnv(env), onRetry };
  if (provider === "openai") {
    return new OpenAICompatible({
      baseUrl: env.SWE_BASE_URL ?? "http://localhost:11434/v1",
      model: env.SWE_MODEL ?? "qwen2.5-coder:14b",
      apiKey: env.SWE_API_KEY,
      retry,
    });
  }
  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    return new Anthropic({ model: env.SWE_MODEL ?? "claude-sonnet-5-5", apiKey: env.ANTHROPIC_API_KEY, retry });
  }
  throw new Error(`Unknown SWE_PROVIDER: ${provider}`);
}
