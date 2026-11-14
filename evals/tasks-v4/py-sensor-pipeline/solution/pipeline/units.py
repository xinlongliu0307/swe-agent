"""Temperature unit conversion.

Unit codes are case-insensitive and may have surrounding spaces: C, F or K.
Unknown codes raise ValueError.
"""


def to_celsius(value, unit):
    code = (unit or "").strip().upper()
    if code == "C":
        return value
    if code == "F":
        return (value - 32) * 5 / 9
    if code == "K":
        return value - 273.15
    raise ValueError("unknown unit: %r" % unit)
