/** Retry settings for model calls; read from env so slow local models can be given more time. */
export type RetryOptions = {
  timeoutMs: number; // per attempt
  retries: number; // extra attempts after the first
  backoffMs: number; // first wait; doubles each retry
  onRetry?: (attempt: number, reason: string) => void;
};

export function retryOptionsFromEnv(env: NodeJS.ProcessEnv): RetryOptions {
  return {
    timeoutMs: Number(env.SWE_TIMEOUT_S ?? 240) * 1000,
    retries: Number(env.SWE_RETRIES ?? 3),
    backoffMs: 2000,
  };
}

const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

/**
 * POST JSON with a per-attempt timeout and exponential backoff.
 * Retries network failures, timeouts and transient HTTP statuses; fails fast on other errors.
 */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  opts: RetryOptions,
): Promise<any> {
  let lastError = "";
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    if (attempt > 0) {
      opts.onRetry?.(attempt, lastError);
      await new Promise((r) => setTimeout(r, opts.backoffMs * 2 ** (attempt - 1)));
    }
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch (err) {
      const e = err as Error & { cause?: { code?: string } };
      lastError = e.name === "TimeoutError" ? `no response within ${opts.timeoutMs / 1000} s` : `${e.message}${e.cause?.code ? ` (${e.cause.code})` : ""}`;
      continue;
    }
    if (res.ok) return res.json();
    const text = await res.text();
    lastError = `HTTP ${res.status}: ${text.slice(0, 300)}`;
    if (!RETRYABLE_STATUS.has(res.status)) break;
  }
  throw new Error(`Model request failed after ${opts.retries + 1} attempt(s): ${lastError}`);
}
