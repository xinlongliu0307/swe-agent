import { parseQuery, type Query } from "./query.ts";

/** Split a URL such as "/search?q=sea+ice&page=2" into its path and parsed query. A URL without "?" has an empty query. */
export function route(url: string): { path: string; query: Query } {
  const i = url.indexOf("?");
  return i < 0 ? { path: url, query: {} } : { path: url.slice(0, i), query: parseQuery(url.slice(i + 1)) };
}
