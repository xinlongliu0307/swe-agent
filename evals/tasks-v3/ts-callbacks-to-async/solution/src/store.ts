export class NotFoundError extends Error {
  constructor(key: string) {
    super(`not found: ${key}`);
    this.name = "NotFoundError";
  }
}

const data = new Map<string, string>();

/** Restore the initial contents (used by tests). */
export function reset(): void {
  data.clear();
  data.set("greeting", "hello");
}
reset();

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

export async function readItem(key: string): Promise<string> {
  await tick();
  if (!data.has(key)) throw new NotFoundError(key);
  return data.get(key)!;
}

export async function writeItem(key: string, value: string): Promise<void> {
  await tick();
  data.set(key, value);
}
