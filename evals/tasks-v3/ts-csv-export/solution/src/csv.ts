/**
 * One CSV field (RFC 4180). A value that contains a comma, a double quote, CR or LF is wrapped in
 * double quotes, and every double quote inside it is doubled. undefined and null become an empty field.
 */
export function field(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** One CSV record, without the line ending. */
export function line(values: unknown[]): string {
  return values.map(field).join(",");
}
