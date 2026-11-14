import unittest

from billing.catalog import get_plan


class CatalogTest(unittest.TestCase):
    def test_plans(self):
        self.assertEqual(get_plan("team").tiers[0], (100, 50))
        with self.assertRaises(KeyError):
            get_plan("gold")


if __name__ == "__main__":
    unittest.main()
