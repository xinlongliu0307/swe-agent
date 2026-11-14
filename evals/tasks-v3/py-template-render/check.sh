#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
from tmpl.render import render, MissingVariable
ctx = {"user": {"name": "ada lovelace", "nick": None}, "n": 3}
assert render("Hi {{ user.name | title }}!", ctx) == "Hi Ada Lovelace!", render("Hi {{ user.name | title }}!", ctx)
assert render("{{user.name|upper|lower}}", ctx) == "ada lovelace"
assert render("[{{ user.nick }}]", ctx) == "[]", "None renders as an empty string"
assert render("{{ n }} items", ctx) == "3 items"
for bad in ("{{ user.nmae }}", "{{ missing.deep }}", "{{ n.x }}"):
    try:
        render(bad, ctx)
        raise AssertionError("expected MissingVariable for " + bad)
    except MissingVariable as e:
        assert bad.strip("{} ") in str(e), "MissingVariable names the variable: " + str(e)
try:
    render("{{ user.name | uper }}", ctx)
    raise AssertionError("expected ValueError for an unknown filter")
except ValueError:
    pass
EOF
