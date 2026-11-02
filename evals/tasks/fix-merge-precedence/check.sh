#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- $(git ls-files "test_*.py") || { echo "tests were edited"; exit 1; }
python3 -m unittest -q 2>/dev/null || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from config import merge
d, o = {"a": 1, "b": 2}, {"b": 3}
assert merge(d, o) == {"a": 1, "b": 3}
assert d == {"a": 1, "b": 2} and o == {"b": 3}
EOF
