export const TAX_RATE = 0.1;

/** Tax on an amount in cents, rounded to the nearest cent. */
export function taxCents(amountCents: number): number {
  return Math.round(amountCents * TAX_RATE);
}
