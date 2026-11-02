import unittest
from config import merge

class T(unittest.TestCase):
    def test_override_wins(self):
        self.assertEqual(merge({"a": 1}, {"a": 2}), {"a": 2})

if __name__ == "__main__":
    unittest.main()
