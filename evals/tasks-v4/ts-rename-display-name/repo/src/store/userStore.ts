import type { User } from "../model/user.ts";
import { fromRecord, toRecord } from "./serialize.ts";

/** Users kept as JSON strings, the way they are kept on disk. */
export class UserStore {
  private raw = new Map<string, string>();

  /** Load records that were saved earlier, e.g. read from disk: id -> JSON. */
  load(records: Record<string, string>): void {
    for (const [id, json] of Object.entries(records)) this.raw.set(id, json);
  }

  dump(): Record<string, string> {
    return Object.fromEntries(this.raw);
  }

  save(user: User): void {
    this.raw.set(user.id, JSON.stringify(toRecord(user)));
  }

  get(id: string): User | undefined {
    const json = this.raw.get(id);
    return json === undefined ? undefined : fromRecord(JSON.parse(json));
  }

  list(): User[] {
    return [...this.raw.keys()].sort().map((id) => this.get(id)!);
  }
}
