import unittest
from cache.lru import LRUCache


class T(unittest.TestCase):
    def test_basic(self):
        c = LRUCache(2)
        c.put("a", 1)
        c.put("b", 2)
        self.assertEqual(c.get("a"), 1)

    def test_eviction(self):
        c = LRUCache(2)
        c.put("a", 1)
        c.put("b", 2)
        c.put("c", 3)
        self.assertIsNone(c.get("a"))


if __name__ == "__main__":
    unittest.main()
