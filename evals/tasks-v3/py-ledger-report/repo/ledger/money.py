def to_cents(amount):
    """'12.50' -> 1250. Negative amounts stay negative."""
    return int(round(float(amount) * 100))


def fmt(cents):
    """1250 -> '$12.50', -5 -> '-$0.05'."""
    sign = "-" if cents < 0 else ""
    cents = abs(cents)
    return "%s$%d.%02d" % (sign, cents // 100, cents % 100)
