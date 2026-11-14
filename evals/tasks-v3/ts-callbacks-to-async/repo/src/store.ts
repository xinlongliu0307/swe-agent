export class NotFoundError extends Error {
  constructor(key: string) {
    super(`not found: ${key}`);
    this.name = "NotFoundError";
  }
}

type Callback<T> = (err: Error | null, value?: T) => void;

const data = new Map<string, string>();

/** Restore the initial contents (used by tests). */
export function reset(): void {
  data.clear();
  data.set("greeting", "hello");
}
reset();

export function readItem(key: string, cb: Callback<string>): void {
  setTimeout(() => {
    if (data.has(key)) cb(null, data.get(key));
    else cb(new NotFoundError(key));
  }, 1);
}

export function writeItem(key: string, value: string, cb: Callback<void>): void {
  setTimeout(() => {
    data.set(key, value);
    cb(null);
  }, 1);
}
