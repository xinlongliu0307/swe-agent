class OutOfStock(Exception):
    pass


class OrderService(object):
    def __init__(self, catalog, stock, notifier):
        self.catalog = catalog
        self.stock = stock
        self.notifier = notifier
        self.orders = {}
        self._next_id = 1
        self._alerted = set()

    def place_order(self, lines):
        """lines: a list of (sku, qty) pairs. Returns the new order id.

        All-or-nothing: if any line cannot be filled, raises OutOfStock(sku) and changes nothing.
        """
        need = {}
        for sku, qty in lines:
            self.catalog.get(sku)
            need[sku] = need.get(sku, 0) + qty
        for sku, qty in need.items():
            if qty > self.stock.available(sku):
                raise OutOfStock(sku)
        for sku in need:
            self._rearm(sku)
        for sku, qty in lines:
            self.stock.take(sku, qty)
        order_id = self._next_id
        self._next_id += 1
        self.orders[order_id] = list(lines)
        for sku in need:
            self._check_low(sku)
        return order_id

    def cancel_order(self, order_id):
        """Put the order's stock back. KeyError for an unknown or already cancelled order."""
        lines = self.orders.pop(order_id)
        for sku, qty in lines:
            self.stock.receive(sku, qty)
        for sku in set(s for s, _ in lines):
            self._rearm(sku)

    def _rearm(self, sku):
        if self.stock.available(sku) >= self.catalog.get(sku).reorder_level:
            self._alerted.discard(sku)

    def _check_low(self, sku):
        if sku not in self._alerted and self.stock.available(sku) < self.catalog.get(sku).reorder_level:
            self._alerted.add(sku)
            self.notifier.low_stock(sku)
