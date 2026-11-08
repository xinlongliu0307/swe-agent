import { formatCents, toCents } from "./money.ts";

export type Line = { description: string; unitPrice: number; quantity: number };

/** Total of all lines in integer cents. Each unit price (in dollars) is converted to cents first. */
export function totalCents(lines: Line[]): number {
  return lines.reduce((sum, l) => sum + toCents(l.unitPrice * l.quantity), 0);
}

export function renderTotal(lines: Line[]): string {
  return `Total: ${formatCents(totalCents(lines))}`;
}
