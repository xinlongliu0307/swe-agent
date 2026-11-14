import os
import tempfile
import unittest

from contacts.io import read_csv, write_csv
from contacts.models import make_contact


class IoTest(unittest.TestCase):
    def test_round_trip(self):
        d = tempfile.mkdtemp()
        p = os.path.join(d, "c.csv")
        people = [make_contact(name="Ada", email="ada@x.org")]
        write_csv(p, people)
        self.assertEqual(read_csv(p), people)


if __name__ == "__main__":
    unittest.main()
