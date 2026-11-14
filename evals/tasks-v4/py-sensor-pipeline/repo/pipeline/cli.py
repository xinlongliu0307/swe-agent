import sys

from .io.reader import read_rows
from .io.writer import write_text
from .parse.records import parse_rows
from .report.daily import daily_means
from .report.format import render
from .transform.clean import drop_duplicates, drop_faults


def run(text):
    """CSV text -> daily report text."""
    readings, skipped = parse_rows(read_rows(text))
    readings, dropped = drop_faults(drop_duplicates(readings))
    return render(daily_means(readings), skipped, dropped)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) not in (1, 2):
        print("usage: python3 -m pipeline.cli input.csv [report.txt]")
        return 2
    with open(argv[0], newline="") as f:
        report = run(f.read())
    if len(argv) == 2:
        write_text(argv[1], report)
    else:
        print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
