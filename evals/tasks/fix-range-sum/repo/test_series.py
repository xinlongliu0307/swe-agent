import unittest
from series import total

class T(unittest.TestCase):
    def test_total(self):
        self.assertEqual(total(3), 6)

if __name__ == "__main__":
    unittest.main()
