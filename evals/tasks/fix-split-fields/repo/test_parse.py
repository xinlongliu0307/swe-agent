import unittest
from parse import split_fields

class T(unittest.TestCase):
    def test_strip(self):
        self.assertEqual(split_fields("a, b ,c"), ["a", "b", "c"])

if __name__ == "__main__":
    unittest.main()
