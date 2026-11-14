import type { ApiClient } from "../client/api.ts";
import type { User } from "../client/types.ts";
import { Emitter } from "../util/events.ts";

/** The search box: shows the results of the query the user typed. */
export class SearchBox {
  query = "";
  results: User[] = [];
  readonly changes = new Emitter<User[]>();
  private api: ApiClient;
  private latest = 0;

  constructor(api: ApiClient) {
    this.api = api;
  }

  /**
   * Called on every keystroke with the full text of the box. Responses can arrive out of order,
   * so only the response to the latest call is shown.
   */
  async search(query: string): Promise<void> {
    const ticket = ++this.latest;
    this.query = query;
    const found = query ? await this.api.searchUsers(query) : [];
    if (ticket !== this.latest) return;
    this.results = found;
    this.changes.emit(found);
  }
}
