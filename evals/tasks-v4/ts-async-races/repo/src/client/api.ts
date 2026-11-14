import type { FakeBackend } from "../backend/fakeBackend.ts";
import { SEARCH_LIMIT, USER_CACHE_TTL_MS } from "../config.ts";
import { type Logger, silentLogger } from "../util/logger.ts";
import { ExpiringMap } from "./cache.ts";
import type { User } from "./types.ts";

export type Backend = Pick<FakeBackend, "fetchUser" | "searchUsers">;

export class ApiClient {
  private backend: Backend;
  private users: ExpiringMap<User>;
  private log: Logger;

  constructor(backend: Backend, log: Logger = silentLogger) {
    this.backend = backend;
    this.users = new ExpiringMap<User>(USER_CACHE_TTL_MS);
    this.log = log;
  }

  /** A user by id, cached for USER_CACHE_TTL_MS. Failed requests are not cached. */
  async getUser(id: string): Promise<User> {
    const cached = this.users.get(id);
    if (cached) return cached;
    this.log.debug(`fetch user ${id}`);
    const user = await this.backend.fetchUser(id);
    this.users.set(id, user);
    return user;
  }

  searchUsers(query: string): Promise<User[]> {
    return this.backend.searchUsers(query, SEARCH_LIMIT);
  }
}
