import sys

from . import geometry


def parse(line):
    """'circle 1.5' -> ('circle', [1.5])"""
    parts = line.split()
    return parts[0], [float(x) for x in parts[1:]]


def main(lines):
    """For each input line, 'kind area perimeter' with two decimals. Returns the output lines."""
    out = []
    for line in lines:
        kind, dims = parse(line)
        out.append("%s %.2f %.2f" % (kind, geometry.area(kind, dims), geometry.perimeter(kind, dims)))
    return out


if __name__ == "__main__":
    print("\n".join(main(sys.stdin.read().splitlines())))
