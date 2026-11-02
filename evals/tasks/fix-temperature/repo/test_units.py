import unittest
from units import c_to_f

class T(unittest.TestCase):
    def test_boiling(self):
        self.assertEqual(c_to_f(100), 212)

if __name__ == "__main__":
    unittest.main()
