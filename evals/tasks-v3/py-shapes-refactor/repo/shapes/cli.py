import math
import sys


def parse(line):
    """'circle 1.5' -> ('circle', [1.5])"""
    parts = line.split()
    return parts[0], [float(x) for x in parts[1:]]


def main(lines):
    """For each input line, 'kind area perimeter' with two decimals. Returns the output lines."""
    out = []
    for line in lines:
        kind, dims = parse(line)
        if kind == "circle":
            area, perim = math.pi * dims[0] ** 2, 2 * math.pi * dims[0]
        elif kind == "rect":
            area, perim = dims[0] * dims[1], 2 * (dims[0] + dims[1])
        elif kind == "triangle":
            a, b, c = dims
            s = (a + b + c) / 2
            area, perim = math.sqrt(s * (s - a) * (s - b) * (s - c)), a + b + c
        else:
            raise ValueError("unknown shape: " + kind)
        out.append("%s %.2f %.2f" % (kind, area, perim))
    return out


if __name__ == "__main__":
    print("\n".join(main(sys.stdin.read().splitlines())))
