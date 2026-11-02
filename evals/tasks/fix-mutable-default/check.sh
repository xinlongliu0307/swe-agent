#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- $(git ls-files "test_*.py") || { echo "tests were edited"; exit 1; }
python3 -m unittest -q 2>/dev/null || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from store import add_item
assert add_item(3, [0]) == [0, 3]
assert add_item(4) == [4]
assert add_item(5) == [5]
EOF
