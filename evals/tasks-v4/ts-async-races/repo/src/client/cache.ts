/** Values with an expiry time. */
export class ExpiringMap<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  private ttlMs: number;
  private now: () => number;

  constructor(ttlMs: number, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(key: string): T | undefined {
    const e = this.entries.get(key);
    if (!e || this.now() >= e.expires) return undefined;
    return e.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
  }
}
