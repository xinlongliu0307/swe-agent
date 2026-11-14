class OutOfStock(Exception):
    pass


class OrderService(object):
    def __init__(self, catalog, stock, notifier):
        self.catalog = catalog
        self.stock = stock
        self.notifier = notifier
        self.orders = {}
        self._next_id = 1

    def place_order(self, lines):
        """lines: a list of (sku, qty) pairs. Returns the new order id."""
        for sku, qty in lines:
            self.catalog.get(sku)
            try:
                self.stock.take(sku, qty)
            except ValueError:
                raise OutOfStock(sku)
        order_id = self._next_id
        self._next_id += 1
        self.orders[order_id] = list(lines)
        return order_id
