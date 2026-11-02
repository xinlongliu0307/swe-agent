#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- $(git ls-files "test_*.py") || { echo "tests were edited"; exit 1; }
python3 -m unittest -q 2>/dev/null || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from text import reverse_words
assert reverse_words("one") == "one"
assert reverse_words("one two") == "two one"
EOF
