def tiered_price(qty, tiers):
    """Total price in cents for qty units under graduated (not volume) pricing.

    tiers is a list of (up_to, unit_cents) pairs sorted by up_to; the last up_to may be None,
    meaning no upper limit. Units 1 to up_to of the first tier cost its unit_cents each, the next
    units up to the second tier's up_to cost the second tier's unit_cents, and so on. For example,
    with [(10, 100), (None, 50)], 12 units cost 10 * 100 + 2 * 50 = 1100.

    qty 0 costs 0. A negative qty raises ValueError. If qty is above the last tier's up_to and
    there is no unlimited tier, raise ValueError.
    """
    raise NotImplementedError
