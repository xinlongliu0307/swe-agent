The area and perimeter formulas are duplicated in shapes/report.py and shapes/cli.py. Refactor:
create shapes/geometry.py with area(kind, dims) and perimeter(kind, dims), which raise
ValueError("unknown shape: <kind>") for an unknown kind, and make report.py and cli.py use them
instead of their own formulas. This is a pure refactor: every existing function must behave exactly
as before, including total_area skipping unknown kinds. Do not edit the tests.
