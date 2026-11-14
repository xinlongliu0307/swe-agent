import type { Line, Order } from "../types.ts";
import type { Clock } from "../util/clock.ts";
import { nextId } from "../util/ids.ts";
import type { OrderRepo } from "../store/orderRepo.ts";
import { priceOrder } from "./pricing.ts";

export class NotFound extends Error {}

export interface OrderChanges {
  lines?: Line[];
  coupon?: string | null;
}

export class OrderService {
  private repo: OrderRepo;
  private clock: Clock;

  constructor(repo: OrderRepo, clock: Clock) {
    this.repo = repo;
    this.clock = clock;
  }

  create(lines: Line[], coupon: string | null = null): Order {
    const now = this.clock.now();
    const order: Order = { id: nextId("ord"), lines, coupon, totalCents: 0, createdAt: now, updatedAt: now };
    order.totalCents = priceOrder(order).total;
    this.repo.save(order);
    return order;
  }

  get(id: string): Order {
    const order = this.repo.get(id);
    if (!order) throw new NotFound(`no order ${id}`);
    return order;
  }

  update(id: string, changes: OrderChanges): Order {
    const updated: Order = { ...this.get(id), ...changes, updatedAt: this.clock.now() };
    updated.totalCents = priceOrder(updated).total;
    this.repo.save(updated);
    return updated;
  }
}
