#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests || { echo "existing tests were edited"; exit 1; }
[ -f tests/test_tiers.py ] || { echo "tests/test_tiers.py is missing"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'PYEOF'
import os, random, shutil, subprocess, sys, tempfile

REFERENCE = '''
def tiered_price(qty, tiers):
    if qty < 0:
        raise ValueError("negative")
    total, start = 0, 0
    for up_to, unit in tiers:
        end = qty if up_to is None else min(qty, up_to)
        if end > start:
            total += (end - start) * unit
        if up_to is None or qty <= up_to:
            return total
        start = up_to
    raise ValueError("above the last tier")
'''
MUTANTS = {
    "volume pricing (all units at the rate of the tier qty falls in)": '''
def tiered_price(qty, tiers):
    if qty < 0:
        raise ValueError("negative")
    for up_to, unit in tiers:
        if up_to is None or qty <= up_to:
            return qty * unit
    raise ValueError("above the last tier")
''',
    "a tier's up_to unit charged at the next tier's rate": REFERENCE.replace("min(qty, up_to)", "min(qty, up_to - 1)").replace("start = up_to", "start = up_to - 1"),
    "negative qty accepted": REFERENCE.replace('raise ValueError("negative")', "return 0"),
    "qty above the last tier priced at its rate": REFERENCE.replace('raise ValueError("above the last tier")', "return total + (qty - start) * tiers[-1][1]"),
    "qty 0 rejected": REFERENCE.replace("if qty < 0:", "if qty <= 0:"),
}

ns = {}
exec(REFERENCE, ns)
ref = ns["tiered_price"]
from billing.tiers import tiered_price
from billing.invoice import build_invoice

def outcome(f, qty, tiers):
    try:
        return f(qty, tiers)
    except ValueError:
        return "ValueError"

rng = random.Random(7)
cases = [(12, [(10, 100), (None, 50)]), (0, [(5, 9)]), (-3, [(5, 9)]), (6, [(5, 9)]), (5, [(5, 9)])]
for _ in range(300):
    bounds = sorted(rng.sample(range(1, 60), rng.randint(1, 4)))
    tiers = [(b, rng.randint(0, 200)) for b in bounds]
    if rng.random() < 0.6:
        tiers.append((None, rng.randint(0, 200)))
    cases.append((rng.randint(-2, 80), tiers))
for qty, tiers in cases:
    want, got = outcome(ref, qty, tiers), outcome(tiered_price, qty, tiers)
    assert got == want, "tiered_price(%r, %r) gave %r, expected %r" % (qty, tiers, got, want)
inv = build_invoice("acme", "team", 1500)
assert (inv["net"], inv["tax"], inv["total"]) == (42000, 4200, 46200), inv

def run_tests_with(source):
    work = tempfile.mkdtemp()
    try:
        for name in ("billing", "tests"):
            shutil.copytree(name, os.path.join(work, name))
        with open(os.path.join(work, "billing", "tiers.py"), "w") as f:
            f.write(source)
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
        p = subprocess.run([sys.executable, "-m", "unittest", "-q", "tests.test_tiers"], cwd=work, env=env,
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True, timeout=60)
        return p.returncode, p.stdout
    finally:
        shutil.rmtree(work)

code, out = run_tests_with(REFERENCE)
assert code == 0, "tests/test_tiers.py fails with a correct implementation:\n" + out[-800:]
assert "Ran 0 tests" not in out, "tests/test_tiers.py contains no tests"
missed = [name for name, src in MUTANTS.items() if run_tests_with(src)[0] == 0]
assert not missed, "tests/test_tiers.py does not catch these wrong implementations: " + "; ".join(missed)
PYEOF
