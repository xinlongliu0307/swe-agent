Users report two problems with the monthly report from the ledger package: a transaction dated on the
1st of a month is counted in two months, and refunds (negative amounts) are added as if they were
payments. The existing tests pass. Find and fix the causes so monthly_totals and render are correct.
Do not edit the tests.
