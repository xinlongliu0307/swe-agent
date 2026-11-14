import type { Line, Order, PriceBreakdown } from "../types.ts";
import { couponPercent } from "./coupons.ts";

export const PRICES: Record<string, number> = { A: 1250, B: 399, C: 10_000 };

/** Price lines with an optional coupon; the discount is rounded to the nearest cent. */
export function priceLines(lines: Line[], coupon: string | null): PriceBreakdown {
  const subtotal = lines.reduce((sum, l) => {
    if (!Object.hasOwn(PRICES, l.sku)) throw new Error(`unknown sku: ${l.sku}`);
    return sum + PRICES[l.sku]! * l.qty;
  }, 0);
  const discount = Math.round((subtotal * couponPercent(coupon)) / 100);
  return { subtotal, discount, total: subtotal - discount };
}

const memo = new Map<string, PriceBreakdown>();

/** The price of an order's current lines and coupon. Memoised, because every read prices the order. */
export function priceOrder(order: Pick<Order, "id" | "lines" | "coupon">): PriceBreakdown {
  const hit = memo.get(order.id);
  if (hit) return hit;
  const result = priceLines(order.lines, order.coupon);
  memo.set(order.id, result);
  return result;
}
