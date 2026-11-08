#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
import pathlib, warnings
from users.models import User, display_name, get_user_name
assert display_name(User("A", "B")) == "A B"
with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    assert get_user_name(User("A", "B")) == "A B"
    assert any(issubclass(x.category, DeprecationWarning) for x in w), "no DeprecationWarning"
for f in ["users/views.py", "reports/summary.py"]:
    src = pathlib.Path(f).read_text()
    assert "get_user_name" not in src, f + " still uses get_user_name"
    assert "display_name" in src, f + " does not use display_name"
EOF
