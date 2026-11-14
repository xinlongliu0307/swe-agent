import type { Clock } from "../util/clock.ts";

/** A read cache with a time-to-live. Entries are copied in and out, so callers cannot change them. */
export class TtlCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  private ttlMs: number;
  private clock: Clock;

  constructor(ttlMs: number, clock: Clock) {
    this.ttlMs = ttlMs;
    this.clock = clock;
  }

  get(key: string): T | undefined {
    const e = this.entries.get(key);
    if (!e) return undefined;
    if (this.clock.now() >= e.expires) {
      this.entries.delete(key);
      return undefined;
    }
    return structuredClone(e.value);
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value: structuredClone(value), expires: this.clock.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}
