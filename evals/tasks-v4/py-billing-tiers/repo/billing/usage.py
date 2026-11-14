from collections import defaultdict


def total_usage(records):
    """{customer: total quantity} from (customer, quantity) records; negative quantities are corrections."""
    totals = defaultdict(int)
    for customer, qty in records:
        totals[customer] += qty
    return dict(totals)
