import unittest
from datetime import datetime

from pipeline.parse.records import Reading
from pipeline.transform.clean import drop_duplicates, drop_faults

T = datetime(2026, 3, 1, 3, 0)


class CleanTest(unittest.TestCase):
    def test_faults(self):
        kept, dropped = drop_faults([Reading("A", T, 20.0), Reading("A", T, 99.0), Reading("A", T, -95.0)])
        self.assertEqual((len(kept), dropped), (1, 2))

    def test_duplicates(self):
        out = drop_duplicates([Reading("A", T, 1.0), Reading("A", T, 2.0), Reading("B", T, 3.0)])
        self.assertEqual([r.celsius for r in out], [1.0, 3.0])


if __name__ == "__main__":
    unittest.main()
