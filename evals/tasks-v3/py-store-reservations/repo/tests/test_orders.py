import unittest

from store.catalog import Catalog, Product
from store.notify import Notifier
from store.orders import OrderService, OutOfStock
from store.stock import Stock


def service():
    stock = Stock()
    stock.receive("A", 10)
    svc = OrderService(Catalog([Product("A", "Apple", 2)]), stock, Notifier())
    return svc, stock


class OrdersTest(unittest.TestCase):
    def test_place_order(self):
        svc, stock = service()
        oid = svc.place_order([("A", 2)])
        self.assertEqual(stock.available("A"), 8)
        self.assertIn(oid, svc.orders)

    def test_out_of_stock(self):
        svc, _ = service()
        with self.assertRaises(OutOfStock):
            svc.place_order([("A", 99)])

    def test_unknown_sku(self):
        svc, _ = service()
        with self.assertRaises(KeyError):
            svc.place_order([("Z", 1)])


if __name__ == "__main__":
    unittest.main()
