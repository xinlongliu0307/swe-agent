from .money import fmt
from .months import months_between, next_month


def monthly_totals(entries):
    """[("YYYY-MM", cents), ...] for every month from the first to the last entry, empty months included."""
    if not entries:
        return []
    dates = [d for d, _, _ in entries]
    out = []
    for m in months_between(min(dates), max(dates)):
        end = next_month(m)
        total = sum(c for d, _, c in entries if m <= d < end)
        out.append((m.strftime("%Y-%m"), total))
    return out


def render(entries):
    """One line per month: 'YYYY-MM $total'."""
    return "\n".join("%s %s" % (month, fmt(total)) for month, total in monthly_totals(entries))
