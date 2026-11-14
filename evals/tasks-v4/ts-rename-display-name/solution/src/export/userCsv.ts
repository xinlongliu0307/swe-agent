import type { User } from "../model/user.ts";
import { line } from "./csv.ts";

export const COLUMNS = ["id", "display_name", "email"] as const;

export function exportUsers(users: User[]): string {
  return line([...COLUMNS]) + users.map((u) => line([u.id, u.displayName, u.email])).join("");
}
