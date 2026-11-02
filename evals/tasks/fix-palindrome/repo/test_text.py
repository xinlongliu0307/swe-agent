import unittest
from text import is_palindrome

class T(unittest.TestCase):
    def test_phrase(self):
        self.assertTrue(is_palindrome("Never odd or even"))

if __name__ == "__main__":
    unittest.main()
