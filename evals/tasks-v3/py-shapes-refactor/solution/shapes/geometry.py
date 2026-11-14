import math


def area(kind, dims):
    if kind == "circle":
        return math.pi * dims[0] ** 2
    if kind == "rect":
        return dims[0] * dims[1]
    if kind == "triangle":
        a, b, c = dims
        s = (a + b + c) / 2
        return math.sqrt(s * (s - a) * (s - b) * (s - c))
    raise ValueError("unknown shape: " + kind)


def perimeter(kind, dims):
    if kind == "circle":
        return 2 * math.pi * dims[0]
    if kind == "rect":
        return 2 * (dims[0] + dims[1])
    if kind == "triangle":
        return sum(dims)
    raise ValueError("unknown shape: " + kind)
