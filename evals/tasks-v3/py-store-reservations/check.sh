#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from store.catalog import Catalog, Product
from store.notify import Notifier
from store.orders import OrderService, OutOfStock
from store.stock import Stock
st = Stock(); st.receive("A", 10); st.receive("B", 1)
n = Notifier()
svc = OrderService(Catalog([Product("A", "Apple", 5), Product("B", "Bean", 0)]), st, n)
try:
    svc.place_order([("A", 3), ("B", 2)])
    raise AssertionError("expected OutOfStock")
except OutOfStock as e:
    assert "B" in str(e), "OutOfStock names the SKU"
assert (st.available("A"), st.available("B")) == (10, 1), "a failed order takes no stock"
o1 = svc.place_order([("A", 6)])
assert o1 == 1, "a failed order does not use up an id"
assert n.alerts == ["A"], "4 < 5 alerts once: %r" % n.alerts
svc.place_order([("A", 1)])
assert n.alerts == ["A"], "no repeat alert while still low"
svc.cancel_order(o1)
assert st.available("A") == 9, "cancel puts stock back"
svc.place_order([("A", 5)])
assert n.alerts == ["A", "A"], "back above the level after a cancel, then low again: %r" % n.alerts
st.receive("A", 6)
svc.place_order([("A", 6)])
assert n.alerts == ["A", "A", "A"], "back above the level after receiving, then low again: %r" % n.alerts
for bad in (o1, 999):
    try:
        svc.cancel_order(bad)
        raise AssertionError("expected KeyError for order %r" % bad)
    except KeyError:
        pass
EOF
