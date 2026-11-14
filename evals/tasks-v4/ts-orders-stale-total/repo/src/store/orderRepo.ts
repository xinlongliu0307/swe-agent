import type { Order } from "../types.ts";
import type { TtlCache } from "./cache.ts";
import type { MemoryStore } from "./memory.ts";

/** Orders, read through the cache. Saving writes the store and drops the cached copy. */
export class OrderRepo {
  private store: MemoryStore<Order>;
  private cache: TtlCache<Order>;

  constructor(store: MemoryStore<Order>, cache: TtlCache<Order>) {
    this.store = store;
    this.cache = cache;
  }

  get(id: string): Order | undefined {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const order = this.store.get(id);
    if (order) this.cache.set(id, order);
    return order;
  }

  save(order: Order): void {
    this.store.set(order.id, order);
    this.cache.delete(order.id);
  }
}
