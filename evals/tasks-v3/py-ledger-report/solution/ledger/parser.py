import datetime

from .money import to_cents


def parse_line(line):
    """'YYYY-MM-DD, description, amount' -> (date, description, cents).

    Amounts are in dollars. Payments are positive and refunds are negative.
    """
    day, desc, amount = [part.strip() for part in line.split(",")]
    d = datetime.datetime.strptime(day, "%Y-%m-%d").date()
    return d, desc, to_cents(amount)


def parse(text):
    """Parse every non-empty line that is not a # comment."""
    return [parse_line(l) for l in text.splitlines() if l.strip() and not l.lstrip().startswith("#")]
