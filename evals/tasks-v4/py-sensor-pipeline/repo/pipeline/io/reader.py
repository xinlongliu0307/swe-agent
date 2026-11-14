import csv
import io

from ..config import CSV_COLUMNS


def read_rows(text):
    """Rows of a CSV export as dicts. The header must contain CSV_COLUMNS, in any order."""
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in CSV_COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError("missing columns: " + ", ".join(missing))
    return [dict(row) for row in reader]


def read_file(path):
    with open(path, newline="") as f:
        return read_rows(f.read())
