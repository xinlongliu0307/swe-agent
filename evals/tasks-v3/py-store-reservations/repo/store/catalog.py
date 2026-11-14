class Product(object):
    def __init__(self, sku, name, reorder_level=0):
        self.sku = sku
        self.name = name
        self.reorder_level = reorder_level


class Catalog(object):
    def __init__(self, products=()):
        self._products = {p.sku: p for p in products}

    def get(self, sku):
        """The Product for sku. Raises KeyError for an unknown SKU."""
        return self._products[sku]
