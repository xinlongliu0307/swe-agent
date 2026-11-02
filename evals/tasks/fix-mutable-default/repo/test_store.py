import unittest
from store import add_item

class T(unittest.TestCase):
    def test_independent_calls(self):
        self.assertEqual(add_item(1), [1])
        self.assertEqual(add_item(2), [2])

if __name__ == "__main__":
    unittest.main()
