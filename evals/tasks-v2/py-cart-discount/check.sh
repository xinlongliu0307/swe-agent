#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from shop.cart import Cart
from shop.discounts import discount_rate
assert discount_rate("save10") == 0.10, "codes are case-insensitive"
assert discount_rate("BOGUS") == 0 and discount_rate(None) == 0, "unknown codes give 0"
c = Cart(); c.add(5)
assert c.total("SAVE10") == 5, "4.5 cents rounds half up to 5"
c = Cart(); c.add(999, 3)
assert c.total("HALF") == 1499, "1498.5 rounds half up"
c = Cart(); c.add(250, 4)
assert c.total() == 1000
EOF
