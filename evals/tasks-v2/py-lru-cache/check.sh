#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from cache.lru import LRUCache
from cache.memo import memoize
c = LRUCache(2); c.put("a", 1); c.put("b", 2); c.get("a"); c.put("c", 3)
assert c.get("a") == 1 and c.get("b") is None, "get() counts as a use"
c = LRUCache(2); c.put("a", 1); c.put("b", 2); c.put("a", 9); c.put("c", 3)
assert c.get("a") == 9 and c.get("b") is None, "put() of an existing key counts as a use"
t = [0.0]
c = LRUCache(5, ttl=10, clock=lambda: t[0]); c.put("x", 1)
t[0] = 5
assert c.get("x") == 1, "not expired yet"
t[0] = 11
assert c.get("x") is None and "x" not in c.data, "expired and removed"
calls = []
@memoize(capacity=2)
def sq(n):
    calls.append(n); return n * n
sq(2); sq(2); sq(3); sq(4); sq(2)
assert calls == [2, 3, 4, 2], calls
EOF
