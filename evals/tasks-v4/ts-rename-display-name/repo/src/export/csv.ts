/** One CSV field: quoted when it contains a comma, a quote or a line break. */
export function field(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function line(values: unknown[]): string {
  return values.map(field).join(",") + "\r\n";
}
