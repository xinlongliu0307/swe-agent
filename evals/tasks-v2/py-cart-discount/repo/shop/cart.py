from .pricing import line_total


class Cart:
    def __init__(self):
        self.lines = []

    def add(self, price_cents, qty=1):
        self.lines.append((price_cents, qty))

    def total(self, code=None):
        """Sum of all lines in cents, with the discount code applied to every line."""
        return sum(line_total(p, q) for p, q in self.lines)
