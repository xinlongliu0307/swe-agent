import type { FakeBackend } from "../backend/fakeBackend.ts";
import { SEARCH_LIMIT, USER_CACHE_TTL_MS } from "../config.ts";
import { type Logger, silentLogger } from "../util/logger.ts";
import { ExpiringMap } from "./cache.ts";
import type { User } from "./types.ts";

export type Backend = Pick<FakeBackend, "fetchUser" | "searchUsers">;

export class ApiClient {
  private backend: Backend;
  private users: ExpiringMap<User>;
  private inFlight = new Map<string, Promise<User>>();
  private log: Logger;

  constructor(backend: Backend, log: Logger = silentLogger) {
    this.backend = backend;
    this.users = new ExpiringMap<User>(USER_CACHE_TTL_MS);
    this.log = log;
  }

  /**
   * A user by id, cached for USER_CACHE_TTL_MS. Concurrent calls for the same id share one
   * backend request. Failed requests are not cached, so the next call tries again.
   */
  getUser(id: string): Promise<User> {
    const cached = this.users.get(id);
    if (cached) return Promise.resolve(cached);
    const pending = this.inFlight.get(id);
    if (pending) return pending;
    this.log.debug(`fetch user ${id}`);
    const request = this.backend
      .fetchUser(id)
      .then((user) => {
        this.users.set(id, user);
        return user;
      })
      .finally(() => this.inFlight.delete(id));
    this.inFlight.set(id, request);
    return request;
  }

  searchUsers(query: string): Promise<User[]> {
    return this.backend.searchUsers(query, SEARCH_LIMIT);
  }
}
