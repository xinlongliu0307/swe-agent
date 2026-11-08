export type RetryOptions = { retries: number; baseMs: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Call fn; if it throws, wait and try again, up to `retries` more times.
 * The waits are baseMs, then 2 * baseMs, then 4 * baseMs, and so on.
 * An error whose `retryable` property is false is rethrown at once, without retrying.
 * When every attempt fails, the last error is thrown.
 */
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if ((err as { retryable?: boolean }).retryable === false || attempt >= opts.retries) throw err;
      await sleep(opts.baseMs * 2 ** attempt);
    }
  }
}
