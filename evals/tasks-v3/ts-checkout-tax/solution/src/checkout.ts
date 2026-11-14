import { resolveCodes } from "./discounts.ts";
import { taxCents } from "./tax.ts";

export interface Item {
  priceCents: number;
  qty: number;
}

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/**
 * The percentages of all valid codes are added together and taken off the subtotal (rounded to the
 * nearest cent). Tax is charged on the discounted amount. total = subtotal - discount + tax.
 */
export function checkout(items: Item[], codes: string[] = []): Totals {
  const subtotal = items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);
  const percent = resolveCodes(codes).reduce((a, b) => a + b, 0);
  const discount = Math.round((subtotal * percent) / 100);
  const tax = taxCents(subtotal - discount);
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}
