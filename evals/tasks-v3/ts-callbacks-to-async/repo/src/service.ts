import { readItem, writeItem } from "./store.ts";

/** The greeting followed by ", world". */
export function welcome(cb: (err: Error | null, message?: string) => void): void {
  readItem("greeting", (err, greeting) => {
    if (err) return cb(err);
    cb(null, `${greeting}, world`);
  });
}

/** Copy the value stored under `from` to `to`. Nothing is written if `from` does not exist. */
export function copy(from: string, to: string, cb: (err: Error | null) => void): void {
  readItem(from, (err, value) => {
    if (err) return cb(err);
    writeItem(to, value!, cb);
  });
}
