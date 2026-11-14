import { NotFound, type OrderChanges, type OrderService } from "../services/orders.ts";
import type { Line } from "../types.ts";
import { formatCents } from "../util/money.ts";
import type { Response, Router } from "./router.ts";

function view(order: { id: string; lines: Line[]; coupon: string | null; totalCents: number }) {
  return { id: order.id, lines: order.lines, coupon: order.coupon, totalCents: order.totalCents, total: formatCents(order.totalCents) };
}

function guard(fn: () => Response): Response {
  try {
    return fn();
  } catch (e) {
    if (e instanceof NotFound) return { status: 404, body: { error: e.message } };
    return { status: 400, body: { error: (e as Error).message } };
  }
}

export function registerOrderRoutes(router: Router, orders: OrderService): void {
  router.on("POST", "/orders", (_p, body) =>
    guard(() => {
      const b = body as { lines: Line[]; coupon?: string | null };
      return { status: 201, body: view(orders.create(b.lines, b.coupon ?? null)) };
    }),
  );
  router.on("GET", "/orders/:id", (p) => guard(() => ({ status: 200, body: view(orders.get(p.id!)) })));
  router.on("PATCH", "/orders/:id", (p, body) => guard(() => ({ status: 200, body: view(orders.update(p.id!, body as OrderChanges)) })));
}
