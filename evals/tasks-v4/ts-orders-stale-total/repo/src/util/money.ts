import { CURRENCY } from "../config.ts";

export function formatCents(cents: number): string {
  return `${CURRENCY} ${(cents / 100).toFixed(2)}`;
}
