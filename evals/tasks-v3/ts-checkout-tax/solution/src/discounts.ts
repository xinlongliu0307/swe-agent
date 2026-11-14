export const CODES: Record<string, number> = { SAVE10: 10, VIP25: 25 };

/** Percent off for each valid code. Unknown codes are ignored and each code counts only once. */
export function resolveCodes(codes: string[]): number[] {
  return [...new Set(codes)].filter((c) => Object.hasOwn(CODES, c)).map((c) => CODES[c]!);
}
