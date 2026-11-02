#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
python3 -m unittest -q 2>/dev/null || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from util import clamp
assert clamp(5, 0, 3) == 3
assert clamp(-1, 0, 3) == 0
assert clamp(2, 0, 3) == 2
try:
    clamp(1, 3, 0)
    raise SystemExit("no ValueError")
except ValueError:
    pass
EOF
