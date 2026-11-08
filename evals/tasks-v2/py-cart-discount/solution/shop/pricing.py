import math

from .discounts import discount_rate


def line_total(price_cents, qty, code=None):
    """Total for one cart line in cents after any discount code, rounded half up to a whole cent."""
    rate = discount_rate(code)
    return math.floor(price_cents * qty * (1 - rate) + 0.5)
