CODES = {"SAVE10": 10, "HALF": 50}


def discount_rate(code):
    """Fraction to take off for a code, e.g. 0.10 for SAVE10.

    Codes are case-insensitive. Unknown or missing codes give 0.
    """
    if code is None:
        return 0
    return CODES.get(code.upper(), 0) / 100
