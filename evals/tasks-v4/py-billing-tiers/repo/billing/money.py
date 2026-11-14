from .config import CURRENCY


def fmt(cents):
    """123456 -> 'AUD 1,234.56'."""
    sign = "-" if cents < 0 else ""
    cents = abs(cents)
    return "%s %s%s.%02d" % (CURRENCY, sign, "{:,}".format(cents // 100), cents % 100)
