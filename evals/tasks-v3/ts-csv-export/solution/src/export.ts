import type { User } from "./models.ts";
import { line } from "./csv.ts";

/**
 * A header row with `columns` in the given order, then one row per user with the same columns.
 * Every line ends with CRLF ("\r\n"), including the last one. With no users the result is just the header.
 */
export function exportUsers(users: User[], columns: (keyof User)[]): string {
  const rows = [line(columns), ...users.map((u) => line(columns.map((c) => u[c])))];
  return rows.map((r) => r + "\r\n").join("");
}
