import { BackendError } from "../client/errors.ts";
import type { User } from "../client/types.ts";
import { sleep } from "../util/sleep.ts";

const USERS: User[] = [
  { id: "u1", name: "Ada" },
  { id: "u2", name: "Adam" },
  { id: "u3", name: "Alan" },
  { id: "u4", name: "Bo" },
];

export interface FakeOptions {
  userDelayMs?: number;
  /** Delay for a search, by query; lets tests make an earlier query answer later. */
  searchDelayMs?: (query: string) => number;
}

/** An in-process stand-in for the server, with call counters and controllable delays. */
export class FakeBackend {
  userCalls = 0;
  searchCalls = 0;
  /** When set, the next fetchUser call fails with this status. */
  failNextUser: number | null = null;
  private opts: FakeOptions;

  constructor(opts: FakeOptions = {}) {
    this.opts = opts;
  }

  async fetchUser(id: string): Promise<User> {
    this.userCalls++;
    const fail = this.failNextUser;
    this.failNextUser = null;
    await sleep(this.opts.userDelayMs ?? 5);
    if (fail !== null) throw new BackendError(fail, `backend error ${fail}`);
    const user = USERS.find((u) => u.id === id);
    if (!user) throw new BackendError(404, `no user ${id}`);
    return { ...user };
  }

  async searchUsers(query: string, limit: number): Promise<User[]> {
    this.searchCalls++;
    await sleep(this.opts.searchDelayMs?.(query) ?? 5);
    const q = query.toLowerCase();
    return USERS.filter((u) => u.name.toLowerCase().startsWith(q)).slice(0, limit).map((u) => ({ ...u }));
  }
}
