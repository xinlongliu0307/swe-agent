import type { User } from "../model/user.ts";
import { tokens } from "./tokenize.ts";

/** Prefix search over users' names and emails. */
export class SearchIndex {
  private byToken = new Map<string, Set<string>>();
  private users = new Map<string, User>();

  add(user: User): void {
    this.users.set(user.id, user);
    for (const t of [...tokens(user.fullName), ...tokens(user.email)]) {
      if (!this.byToken.has(t)) this.byToken.set(t, new Set());
      this.byToken.get(t)!.add(user.id);
    }
  }

  /** Users with a token starting with every word of the query, sorted by name. */
  search(query: string): User[] {
    const words = tokens(query);
    if (!words.length) return [];
    const ids = [...this.users.keys()].filter((id) =>
      words.every((w) => [...this.byToken].some(([t, set]) => t.startsWith(w) && set.has(id))),
    );
    return ids.map((id) => this.users.get(id)!).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
}

export function buildIndex(users: User[]): SearchIndex {
  const index = new SearchIndex();
  for (const u of users) index.add(u);
  return index;
}
