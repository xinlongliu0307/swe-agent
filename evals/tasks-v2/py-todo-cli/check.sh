#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
import json, os, tempfile
from todo.cli import main
path = os.path.join(tempfile.mkdtemp(), "t.json")
main(["add", "a"], path); main(["add", "b"], path)
assert main(["done", "1"], path) == []
assert main(["list"], path) == ["1. [x] a", "2. [ ] b"], "done N is 1-based and saved"
before = open(path).read()
assert main(["done", "3"], path) == ["no such item: 3"]
assert main(["done", "0"], path) == ["no such item: 0"]
assert open(path).read() == before, "a bad done changes nothing"
EOF
