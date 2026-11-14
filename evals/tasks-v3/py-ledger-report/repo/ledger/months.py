def month_start(d):
    return d.replace(day=1)


def next_month(d):
    """First day of the month after d's month."""
    d = month_start(d)
    if d.month == 12:
        return d.replace(year=d.year + 1, month=1)
    return d.replace(month=d.month + 1)


def months_between(first, last):
    """First days of every month from first's month to last's month, inclusive."""
    out = []
    m = month_start(first)
    while m <= last:
        out.append(m)
        m = next_month(m)
    return out
