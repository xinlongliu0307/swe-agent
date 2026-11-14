import { CACHE_TTL_MS } from "./config.ts";
import { registerOrderRoutes } from "./http/handlers.ts";
import { Router } from "./http/router.ts";
import { OrderService } from "./services/orders.ts";
import { TtlCache } from "./store/cache.ts";
import { MemoryStore } from "./store/memory.ts";
import { OrderRepo } from "./store/orderRepo.ts";
import type { Order } from "./types.ts";
import { type Clock, systemClock } from "./util/clock.ts";

export function createApp(clock: Clock = systemClock) {
  const store = new MemoryStore<Order>();
  const cache = new TtlCache<Order>(CACHE_TTL_MS, clock);
  const orders = new OrderService(new OrderRepo(store, cache), clock);
  const router = new Router();
  registerOrderRoutes(router, orders);
  return { handle: router.handle.bind(router), store, orders };
}
