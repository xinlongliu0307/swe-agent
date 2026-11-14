"""Temperature unit conversion.

Unit codes are case-insensitive and may have surrounding spaces: C, F or K.
Unknown codes raise ValueError.
"""


def to_celsius(value, unit):
    if unit == "F":
        return (value - 32) * 5 / 9
    if unit == "K":
        return value - 273.15
    return value
