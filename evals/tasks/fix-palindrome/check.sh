#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- $(git ls-files "test_*.py") || { echo "tests were edited"; exit 1; }
python3 -m unittest -q 2>/dev/null || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from text import is_palindrome
assert is_palindrome("A man, a plan, a canal: Panama")
assert not is_palindrome("sea ice")
assert is_palindrome("abba")
EOF
