import unittest

from billing.tax import tax_cents


class TaxTest(unittest.TestCase):
    def test_rounding(self):
        self.assertEqual(tax_cents(1000), 100)
        self.assertEqual(tax_cents(5), 1)
        self.assertEqual(tax_cents(4), 0)


if __name__ == "__main__":
    unittest.main()
