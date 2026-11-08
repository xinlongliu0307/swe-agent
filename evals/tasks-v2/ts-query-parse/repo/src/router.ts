import { parseQuery, type Query } from "./query.ts";

/** Split a URL such as "/search?q=sea+ice&page=2" into its path and parsed query. A URL without "?" has an empty query. */
export function route(url: string): { path: string; query: Query } {
  const [path, qs] = url.split("?");
  return { path, query: parseQuery(qs) };
}
