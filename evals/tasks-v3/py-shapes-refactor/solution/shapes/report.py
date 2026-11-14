from . import geometry


def describe(kind, dims):
    """One line like 'circle: area 7.07, perimeter 9.42'."""
    area, perim = geometry.area(kind, dims), geometry.perimeter(kind, dims)
    return "%s: area %.2f, perimeter %.2f" % (kind, area, perim)


def total_area(shapes):
    """Sum of the areas of (kind, dims) pairs. Unknown kinds are skipped."""
    total = 0.0
    for kind, dims in shapes:
        try:
            total += geometry.area(kind, dims)
        except ValueError:
            pass
    return total
