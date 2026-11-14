import unittest

from pipeline.cli import run

CSV = """station,time,value,unit
SYD,2026-03-01T03:00:00Z,22.0,C
SYD,2026-03-01T09:00:00Z,24.0,C
SYD,2026-03-01T09:00:00Z,99.0,C
"""


class CliTest(unittest.TestCase):
    def test_run(self):
        self.assertEqual(run(CSV), "SYD      2026-03-01   23.0\nskipped rows: 0, sensor faults: 0")


if __name__ == "__main__":
    unittest.main()
