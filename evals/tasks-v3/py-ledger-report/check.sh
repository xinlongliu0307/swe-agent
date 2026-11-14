#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from ledger.parser import parse, parse_line
from ledger.report import monthly_totals, render
es = parse("2026-01-31,a,10\n2026-02-01,b,5\n2026-03-01,c,1\n")
assert monthly_totals(es) == [("2026-01", 1000), ("2026-02", 500), ("2026-03", 100)], "an entry on the 1st belongs to one month only: %r" % (monthly_totals(es),)
assert parse_line("2026-04-02, Refund, -12.50")[2] == -1250, "refunds stay negative"
es = parse("2026-04-01,pay,27.25\n2026-04-30,refund,-12.50\n2026-06-01,x,1\n")
assert monthly_totals(es) == [("2026-04", 1475), ("2026-05", 0), ("2026-06", 100)], monthly_totals(es)
assert render(parse("2025-12-31,a,1\n2026-01-01,b,-2\n")) == "2025-12 $1.00\n2026-01 -$2.00"
EOF
