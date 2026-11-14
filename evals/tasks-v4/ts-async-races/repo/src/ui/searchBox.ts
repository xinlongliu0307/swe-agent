import type { ApiClient } from "../client/api.ts";
import type { User } from "../client/types.ts";
import { Emitter } from "../util/events.ts";

/** The search box: shows the results of the query the user typed. */
export class SearchBox {
  query = "";
  results: User[] = [];
  readonly changes = new Emitter<User[]>();
  private api: ApiClient;

  constructor(api: ApiClient) {
    this.api = api;
  }

  /** Called on every keystroke with the full text of the box. */
  async search(query: string): Promise<void> {
    this.query = query;
    const found = query ? await this.api.searchUsers(query) : [];
    this.results = found;
    this.changes.emit(found);
  }
}
