import unittest

from billing.usage import total_usage


class UsageTest(unittest.TestCase):
    def test_totals(self):
        self.assertEqual(total_usage([("a", 5), ("b", 1), ("a", -2)]), {"a": 3, "b": 1})


if __name__ == "__main__":
    unittest.main()
