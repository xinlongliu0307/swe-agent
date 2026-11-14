import datetime

FORMAT = "%Y-%m-%dT%H:%M:%S"


def parse_timestamp(text):
    """Parse an ISO 8601 timestamp such as 2026-03-01T08:00:00Z or 2026-03-01T08:00:00+10:00.

    Returns a naive datetime in UTC. The offset is required: Z, or +HH:MM / -HH:MM.
    Raises ValueError for anything else.
    """
    text = text.strip()
    if not (text.endswith("Z") or text[-6:-5] in ("+", "-")):
        raise ValueError("timestamp needs an offset: %r" % text)
    return datetime.datetime.strptime(text[:19], FORMAT)
