import unittest
import os
import tempfile

from app.config import load
from app.main import server_address


class T(unittest.TestCase):
    def test_defaults(self):
        self.assertEqual(load()["log"]["level"], "INFO")

    def test_ini_file(self):
        path = os.path.join(tempfile.mkdtemp(), "a.ini")
        with open(path, "w") as f:
            f.write("[server]\nport = 9000\n")
        self.assertEqual(server_address(path), ("127.0.0.1", 9000))


if __name__ == "__main__":
    unittest.main()
