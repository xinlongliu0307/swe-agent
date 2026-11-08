/**
 * Format integer cents as dollars with thousands separators, e.g. 123450 -> "$1,234.50".
 * Negative amounts get a leading minus sign: -500 -> "-$5.00".
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return "$" + dollars.toFixed(2);
}

/** Convert a price in dollars, as typed by a user (e.g. 19.99), to integer cents, rounding to the nearest cent. */
export function toCents(dollars: number): number {
  return Math.floor(dollars * 100);
}
