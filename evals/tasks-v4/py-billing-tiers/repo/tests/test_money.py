import unittest

from billing.money import fmt


class MoneyTest(unittest.TestCase):
    def test_fmt(self):
        self.assertEqual(fmt(123456), "AUD 1,234.56")
        self.assertEqual(fmt(-5), "AUD -0.05")


if __name__ == "__main__":
    unittest.main()
