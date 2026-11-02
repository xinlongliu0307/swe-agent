#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
grep -q median test_stats.py || { echo "no test for median"; exit 1; }
python3 -m unittest -q 2>/dev/null || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from stats import median
xs = [3, 1, 2]
assert median(xs) == 2 and xs == [3, 1, 2]
assert median([4, 1, 3, 2]) == 2.5
assert median([5]) == 5
EOF
