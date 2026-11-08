import unittest
from shop.cart import Cart


class T(unittest.TestCase):
    def test_save10(self):
        c = Cart()
        c.add(1000, 2)
        self.assertEqual(c.total("SAVE10"), 1800)


if __name__ == "__main__":
    unittest.main()
