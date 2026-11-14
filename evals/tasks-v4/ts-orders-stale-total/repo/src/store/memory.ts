/** In-memory key-value store. Counts reads so callers can see whether a cache is working. */
export class MemoryStore<T> {
  private data = new Map<string, T>();
  reads = 0;
  writes = 0;

  get(key: string): T | undefined {
    this.reads++;
    const v = this.data.get(key);
    return v === undefined ? undefined : structuredClone(v);
  }

  set(key: string, value: T): void {
    this.writes++;
    this.data.set(key, structuredClone(value));
  }

  keys(): string[] {
    return [...this.data.keys()];
  }
}
