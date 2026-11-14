#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from datetime import datetime
from pipeline.parse.timestamps import parse_timestamp
from pipeline.units import to_celsius
from pipeline.cli import run
assert parse_timestamp("2026-03-01T08:00:00+10:00") == datetime(2026, 2, 28, 22, 0), "+10:00 is converted to UTC: %r" % (parse_timestamp("2026-03-01T08:00:00+10:00"),)
assert parse_timestamp("2026-03-01T08:00:00-05:30") == datetime(2026, 3, 1, 13, 30), "-05:30 is converted to UTC"
assert parse_timestamp(" 2026-03-01T23:15:00Z ") == datetime(2026, 3, 1, 23, 15)
for bad in ("2026-03-01 08:00", "2026-03-01T08:00:00", "2026-03-01T08:00:00+10"):
    try:
        parse_timestamp(bad)
        raise AssertionError("expected ValueError for %r" % bad)
    except ValueError:
        pass
assert abs(to_celsius(212, "f") - 100) < 1e-9 and to_celsius(20, "c") == 20 and abs(to_celsius(300, " k ") - 26.85) < 1e-9, "unit codes are case-insensitive"
try:
    to_celsius(1, "X")
    raise AssertionError("expected ValueError for an unknown unit")
except ValueError:
    pass
CSV = """station,time,value,unit
HBA,2026-03-01T08:00:00+10:00,12.0,C
HBA,2026-03-01T20:00:00+10:00,18.0,C
HBA,2026-03-01T22:00:00Z,16.0,C
NYC,2026-03-01T20:00:00-05:00,41,f
NYC,2026-03-01T10:00:00-05:00,50,F
LAB,2026-03-01T10:00:00Z,300,X
"""
rows = [("HBA", "2026-02-28", 12.0), ("HBA", "2026-03-01", 17.0), ("NYC", "2026-03-01", 10.0), ("NYC", "2026-03-02", 5.0)]
expected = "\n".join(["%-8s %s %6.1f" % r for r in rows] + ["skipped rows: 1, sensor faults: 0"])
got = run(CSV)
assert got == expected, "report:\n" + got
EOF
