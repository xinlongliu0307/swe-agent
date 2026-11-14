/** Percent off per coupon code. */
export const COUPONS: Record<string, number> = { TEN: 10, HALF: 50 };

export function couponPercent(code: string | null): number {
  if (code === null) return 0;
  if (!Object.hasOwn(COUPONS, code)) throw new Error(`unknown coupon: ${code}`);
  return COUPONS[code]!;
}
