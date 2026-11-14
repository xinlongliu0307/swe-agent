import sys

from .io import read_csv, write_csv
from .merge import dedupe
from .report import summary


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 2:
        print("usage: python3 -m contacts.cli export.csv merged.csv")
        return 2
    contacts = read_csv(argv[0])
    merged = dedupe(contacts)
    write_csv(argv[1], merged)
    print(summary(contacts, merged))
    return 0


if __name__ == "__main__":
    sys.exit(main())
