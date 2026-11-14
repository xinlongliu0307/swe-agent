Implement tiered_price in billing/tiers.py as its docstring describes (billing/invoice.py uses it),
and add a new test module, tests/test_tiers.py, that tests it thoroughly. Your tests are part of
the work: they must pass with a correct implementation and fail with a wrong one. Cover every rule
in the docstring: a price within one tier and across several tiers, the exact boundary between two
tiers, qty 0, a negative qty, and a qty above the last tier when there is no unlimited tier.
Do not change the existing test files.
