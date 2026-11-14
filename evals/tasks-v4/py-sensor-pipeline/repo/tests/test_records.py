import unittest
from datetime import datetime

from pipeline.parse.records import parse_row, parse_rows


class RecordsTest(unittest.TestCase):
    def test_utc_celsius(self):
        r = parse_row({"station": "SYD", "time": "2026-03-01T03:00:00Z", "value": "22.5", "unit": "C"})
        self.assertEqual(r, ("SYD", datetime(2026, 3, 1, 3, 0), 22.5))

    def test_fahrenheit(self):
        r = parse_row({"station": "NYC", "time": "2026-03-01T03:00:00Z", "value": "50", "unit": "F"})
        self.assertAlmostEqual(r.celsius, 10.0)

    def test_bad_rows_are_skipped(self):
        rows = [
            {"station": "", "time": "2026-03-01T03:00:00Z", "value": "1", "unit": "C"},
            {"station": "A", "time": "yesterday", "value": "1", "unit": "C"},
            {"station": "A", "time": "2026-03-01T03:00:00Z", "value": "1", "unit": "C"},
        ]
        readings, skipped = parse_rows(rows)
        self.assertEqual((len(readings), skipped), (1, 2))


if __name__ == "__main__":
    unittest.main()
