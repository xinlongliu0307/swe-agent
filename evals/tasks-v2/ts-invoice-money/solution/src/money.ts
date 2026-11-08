/**
 * Format integer cents as dollars with thousands separators, e.g. 123450 -> "$1,234.50".
 * Negative amounts get a leading minus sign: -500 -> "-$5.00".
 */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${whole}.${String(abs % 100).padStart(2, "0")}`;
}

/** Convert a price in dollars, as typed by a user (e.g. 19.99), to integer cents, rounding to the nearest cent. */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}
