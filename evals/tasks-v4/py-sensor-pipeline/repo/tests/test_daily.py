import unittest
from datetime import datetime

from pipeline.parse.records import Reading
from pipeline.report.daily import daily_means
from pipeline.report.format import render


class DailyTest(unittest.TestCase):
    def test_means_per_utc_day(self):
        rs = [Reading("A", datetime(2026, 3, 1, 1), 10.0), Reading("A", datetime(2026, 3, 1, 23), 20.0),
              Reading("A", datetime(2026, 3, 2, 0), 4.0)]
        self.assertEqual(daily_means(rs), {("A", "2026-03-01"): 15.0, ("A", "2026-03-02"): 4.0})

    def test_render(self):
        text = render({("B", "2026-03-01"): 2.0, ("A", "2026-03-01"): 1.25}, skipped=1)
        self.assertEqual(text.splitlines(), ["A        2026-03-01    1.2", "B        2026-03-01    2.0",
                                             "skipped rows: 1, sensor faults: 0"])


if __name__ == "__main__":
    unittest.main()
