import unittest
from datetime import date

from ledger.money import fmt
from ledger.parser import parse, parse_line
from ledger.report import monthly_totals


class LedgerTest(unittest.TestCase):
    def test_parse_payment(self):
        self.assertEqual(parse_line("2026-01-15, Rent, 1200.50"), (date(2026, 1, 15), "Rent", 120050))

    def test_comments_are_skipped(self):
        self.assertEqual(len(parse("# header\n2026-01-15,a,1\n\n")), 1)

    def test_monthly_totals_mid_month(self):
        es = parse("2026-01-10,a,10\n2026-01-20,b,5\n2026-03-05,c,1\n")
        self.assertEqual(monthly_totals(es), [("2026-01", 1500), ("2026-02", 0), ("2026-03", 100)])

    def test_fmt(self):
        self.assertEqual(fmt(123456), "$1234.56")
        self.assertEqual(fmt(-5), "-$0.05")


if __name__ == "__main__":
    unittest.main()
