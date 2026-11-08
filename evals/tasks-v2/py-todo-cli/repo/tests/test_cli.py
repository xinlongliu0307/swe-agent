import unittest
import os
import tempfile

from todo.cli import main


class T(unittest.TestCase):
    def test_add_then_list(self):
        path = os.path.join(tempfile.mkdtemp(), "t.json")
        main(["add", "buy milk"], path)
        self.assertEqual(main(["list"], path), ["1. [ ] buy milk"])


if __name__ == "__main__":
    unittest.main()
