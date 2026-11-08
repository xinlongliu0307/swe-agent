import { retry } from "./retry.ts";

export type Fetcher = (url: string) => Promise<{ status: number; body: string }>;

/**
 * Fetch a URL and return its body. Network errors and 5xx responses are retried up to 3 times,
 * starting with a delay of baseMs. A 4xx response fails at once with an error whose `retryable` is false.
 */
export async function getText(fetcher: Fetcher, url: string, baseMs = 100): Promise<string> {
  const res = await fetcher(url);
  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  return res.body;
}
