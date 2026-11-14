#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
import random, subprocess, sys

# The original implementation, kept here so results can be compared on random inputs.
FIELDS = ("name", "email", "phone", "company")
def _ne(e): return (e or "").strip().lower()
def _np(p):
    d = "".join(ch for ch in (p or "") if ch.isdigit())
    return "0" + d[2:] if len(d) == 11 and d.startswith("61") else d
def _same(a, b):
    ea, eb = _ne(a.get("email")), _ne(b.get("email"))
    if ea and ea == eb:
        return True
    pa, pb = _np(a.get("phone")), _np(b.get("phone"))
    return bool(pa) and pa == pb
def _merge(people): return {f: next((p.get(f) for p in people if p.get(f)), "") for f in FIELDS}
def original(contacts):
    groups = []
    for i, c in enumerate(contacts):
        hits = [g for g in groups if any(_same(contacts[j], c) for j in g)]
        merged = [i]
        for g in hits:
            merged.extend(g)
            groups.remove(g)
        groups.append(sorted(merged))
    groups.sort(key=lambda g: g[0])
    return [_merge([contacts[j] for j in g]) for g in groups]

from contacts.merge import dedupe
rng = random.Random(42)
EMAILS = ["a@x.org", "A@x.org ", "b@x.org", "c@y.com", "", "", None]
PHONES = ["0400 000 001", "+61 400 000 001", "0400000002", "03 6226 2999", "", None, "abc"]
for n in range(400):
    people = [{"name": rng.choice(["", "Ada", "Bo", "Cy", None]), "email": rng.choice(EMAILS),
               "phone": rng.choice(PHONES), "company": rng.choice(["", "Acme", "Initech"])}
              for _ in range(rng.randint(0, 9))]
    want, got = original(people), dedupe(people)
    assert got == want, "dedupe changed its result for %r:\n got %r\nwant %r" % (people, got, want)

BIG = r'''
import random, time
from contacts.merge import dedupe
rng = random.Random(1)
people = [{"name": "P%d" % i, "email": "u%d@x.org" % rng.randrange(12000) if rng.random() < 0.8 else "",
           "phone": "04%08d" % rng.randrange(12000) if rng.random() < 0.6 else "", "company": ""}
          for i in range(20000)]
t = time.time()
out = dedupe(people)
print("%.2f %d" % (time.time() - t, len(out)))
'''
try:
    p = subprocess.run([sys.executable, "-c", BIG], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       universal_newlines=True, timeout=20)
except subprocess.TimeoutExpired:
    raise AssertionError("dedupe of 20,000 contacts did not finish within 20 s")
assert p.returncode == 0, p.stdout[-800:]
seconds = float(p.stdout.split()[0])
assert seconds < 5, "dedupe of 20,000 contacts took %.1f s" % seconds
EOF
