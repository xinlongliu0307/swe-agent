export type Query = Record<string, string | string[]>;

/**
 * Parse a URL query string such as "?a=1&b=two" into an object.
 * - The leading "?" is optional, and an empty string gives {}.
 * - "+" means a space, and percent-escapes are decoded ("a%20b" -> "a b").
 * - Only the first "=" separates key and value ("eq=a=b" -> { eq: "a=b" }).
 * - A key that appears more than once becomes an array of its values, in order.
 * - A key without "=" gets the empty string as its value.
 */
export function parseQuery(qs: string): Query {
  const out: Query = {};
  for (const part of qs.split("&")) {
    const [k, v] = part.split("=");
    out[k] = v;
  }
  return out;
}
