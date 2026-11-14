from collections import namedtuple

from ..units import to_celsius
from .timestamps import parse_timestamp

Reading = namedtuple("Reading", "station time celsius")


def parse_row(row):
    """A CSV row dict -> Reading with the time in UTC and the value in Celsius.

    Raises ValueError for a bad row.
    """
    station = row["station"].strip()
    if not station:
        raise ValueError("empty station")
    return Reading(station, parse_timestamp(row["time"]), to_celsius(float(row["value"]), row["unit"]))


def parse_rows(rows):
    """(readings, skipped): rows that raise ValueError are skipped and counted."""
    readings, skipped = [], 0
    for row in rows:
        try:
            readings.append(parse_row(row))
        except ValueError:
            skipped += 1
    return readings, skipped
