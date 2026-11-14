class Stock(object):
    """Available quantity per SKU."""

    def __init__(self):
        self._qty = {}

    def receive(self, sku, qty):
        self._qty[sku] = self._qty.get(sku, 0) + qty

    def available(self, sku):
        return self._qty.get(sku, 0)

    def take(self, sku, qty):
        if qty > self.available(sku):
            raise ValueError("not enough %s" % sku)
        self._qty[sku] -= qty
