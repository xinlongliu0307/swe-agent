import { readItem, writeItem } from "./store.ts";

/** The greeting followed by ", world". */
export async function welcome(): Promise<string> {
  return `${await readItem("greeting")}, world`;
}

/** Copy the value stored under `from` to `to`. Nothing is written if `from` does not exist. */
export async function copy(from: string, to: string): Promise<void> {
  await writeItem(to, await readItem(from));
}
