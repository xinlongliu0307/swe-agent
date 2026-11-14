import sys

from .parser import parse
from .report import render


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    with open(argv[0]) as f:
        print(render(parse(f.read())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
