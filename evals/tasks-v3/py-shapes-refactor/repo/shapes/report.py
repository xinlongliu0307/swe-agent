import math


def describe(kind, dims):
    """One line like 'circle: area 7.07, perimeter 9.42'."""
    if kind == "circle":
        (r,) = dims
        area, perim = math.pi * r * r, 2 * math.pi * r
    elif kind == "rect":
        w, h = dims
        area, perim = w * h, 2 * (w + h)
    elif kind == "triangle":
        a, b, c = dims
        s = (a + b + c) / 2
        area = math.sqrt(s * (s - a) * (s - b) * (s - c))
        perim = a + b + c
    else:
        raise ValueError("unknown shape: " + kind)
    return "%s: area %.2f, perimeter %.2f" % (kind, area, perim)


def total_area(shapes):
    """Sum of the areas of (kind, dims) pairs. Unknown kinds are skipped."""
    total = 0.0
    for kind, dims in shapes:
        if kind == "circle":
            total += math.pi * dims[0] ** 2
        elif kind == "rect":
            total += dims[0] * dims[1]
        elif kind == "triangle":
            a, b, c = dims
            s = (a + b + c) / 2
            total += math.sqrt(s * (s - a) * (s - b) * (s - c))
    return total
