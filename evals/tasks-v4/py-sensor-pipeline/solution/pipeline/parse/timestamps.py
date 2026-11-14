import datetime
import re

FORMAT = "%Y-%m-%dT%H:%M:%S"
OFFSET = re.compile(r"^([+-])(\d\d):(\d\d)$")


def parse_timestamp(text):
    """Parse an ISO 8601 timestamp such as 2026-03-01T08:00:00Z or 2026-03-01T08:00:00+10:00.

    Returns a naive datetime in UTC. The offset is required: Z, or +HH:MM / -HH:MM.
    Raises ValueError for anything else.
    """
    text = text.strip()
    base = datetime.datetime.strptime(text[:19], FORMAT)
    rest = text[19:]
    if rest == "Z":
        return base
    m = OFFSET.match(rest)
    if not m:
        raise ValueError("timestamp needs an offset: %r" % text)
    offset = datetime.timedelta(hours=int(m.group(2)), minutes=int(m.group(3)))
    return base - offset if m.group(1) == "+" else base + offset
