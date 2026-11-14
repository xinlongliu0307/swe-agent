#!/usr/bin/env bash
# Exit 0 = solved. Runs inside a fresh copy of repo/.
set -e
git diff --quiet HEAD -- tests test || { echo "tests were edited"; exit 1; }
python3 -m unittest discover -s tests -t . -q >/dev/null 2>&1 || { echo "visible tests fail"; exit 1; }
python3 - <<'EOF'
import math, os, re
from shapes import geometry
from shapes.cli import main
from shapes.report import describe, total_area
assert abs(geometry.area("circle", [1.5]) - math.pi * 2.25) < 1e-9
assert abs(geometry.perimeter("circle", [1.5]) - 3 * math.pi) < 1e-9
assert geometry.area("rect", [2, 3.5]) == 7.0 and geometry.perimeter("rect", [2, 3.5]) == 11.0
assert abs(geometry.area("triangle", [3, 4, 5]) - 6.0) < 1e-9 and geometry.perimeter("triangle", [3, 4, 5]) == 12
for f in (geometry.area, geometry.perimeter):
    try:
        f("hexagon", [1])
        raise AssertionError("expected ValueError from geometry." + f.__name__)
    except ValueError as e:
        assert str(e) == "unknown shape: hexagon", str(e)
assert describe("circle", [1.5]) == "circle: area 7.07, perimeter 9.42", describe("circle", [1.5])
assert abs(total_area([("rect", [2, 3]), ("hexagon", [1]), ("triangle", [3, 4, 5])]) - 12.0) < 1e-9, "unknown kinds are still skipped"
assert main(["circle 1", "rect 2 3"]) == ["circle 3.14 6.28", "rect 6.00 10.00"]
try:
    main(["hexagon 1"])
    raise AssertionError("expected ValueError from cli.main")
except ValueError as e:
    assert str(e) == "unknown shape: hexagon", str(e)
for name in ("report.py", "cli.py"):
    src = open(os.path.join("shapes", name)).read()
    assert not re.search(r"\bpi\b|sqrt", src), name + " still has its own formulas"
    assert "geometry" in src, name + " does not use geometry"
EOF
