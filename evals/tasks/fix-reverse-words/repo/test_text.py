import unittest
from text import reverse_words

class T(unittest.TestCase):
    def test_reverse_words(self):
        self.assertEqual(reverse_words("sea ice melts"), "melts ice sea")

if __name__ == "__main__":
    unittest.main()
