#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- $(git ls-files "test_*.py") || { echo "tests were edited"; exit 1; }
python3 -m unittest -q 2>/dev/null || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from series import total
assert total(1) == 1
assert total(10) == 55
EOF
