import { paginate } from "./paginate.ts";

const USERS = Array.from({ length: 23 }, (_, i) => `user${i + 1}`);

/** GET /users?page=N with 10 users per page. A missing or non-numeric page means page 1. */
export function listUsers(query: { page?: string }) {
  const n = Number(query.page);
  return paginate(USERS, Number.isNaN(n) || query.page === undefined ? 1 : n, 10);
}
