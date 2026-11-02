import unittest
import util

class T(unittest.TestCase):
    def test_module_imports(self):
        self.assertTrue(hasattr(util, "__doc__"))

if __name__ == "__main__":
    unittest.main()
