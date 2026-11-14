import type { ApiClient } from "../client/api.ts";

/** A small card with a user's name; several cards may show the same user. */
export async function renderUserCard(api: ApiClient, id: string): Promise<string> {
  const user = await api.getUser(id);
  return `[${user.id}] ${user.name}`;
}
