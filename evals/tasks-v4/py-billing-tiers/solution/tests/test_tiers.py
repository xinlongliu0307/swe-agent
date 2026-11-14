import unittest

from billing.tiers import tiered_price

TIERS = [(10, 100), (20, 70), (None, 50)]
CAPPED = [(10, 100), (20, 70)]


class TieredPriceTest(unittest.TestCase):
    def test_within_first_tier(self):
        self.assertEqual(tiered_price(3, TIERS), 300)

    def test_across_tiers(self):
        self.assertEqual(tiered_price(25, TIERS), 10 * 100 + 10 * 70 + 5 * 50)

    def test_exact_boundary(self):
        self.assertEqual(tiered_price(10, TIERS), 1000)
        self.assertEqual(tiered_price(11, TIERS), 1070)

    def test_zero(self):
        self.assertEqual(tiered_price(0, TIERS), 0)

    def test_negative(self):
        with self.assertRaises(ValueError):
            tiered_price(-1, TIERS)

    def test_beyond_last_tier(self):
        self.assertEqual(tiered_price(20, CAPPED), 1700)
        with self.assertRaises(ValueError):
            tiered_price(21, CAPPED)


if __name__ == "__main__":
    unittest.main()
