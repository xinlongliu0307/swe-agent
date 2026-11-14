def tiered_price(qty, tiers):
    """Total price in cents for qty units under graduated (not volume) pricing.

    tiers is a list of (up_to, unit_cents) pairs sorted by up_to; the last up_to may be None,
    meaning no upper limit. Units 1 to up_to of the first tier cost its unit_cents each, the next
    units up to the second tier's up_to cost the second tier's unit_cents, and so on. For example,
    with [(10, 100), (None, 50)], 12 units cost 10 * 100 + 2 * 50 = 1100.

    qty 0 costs 0. A negative qty raises ValueError. If qty is above the last tier's up_to and
    there is no unlimited tier, raise ValueError.
    """
    if qty < 0:
        raise ValueError("negative quantity: %d" % qty)
    total, start = 0, 0
    for up_to, unit in tiers:
        end = qty if up_to is None else min(qty, up_to)
        if end > start:
            total += (end - start) * unit
        if up_to is None or qty <= up_to:
            return total
        start = up_to
    raise ValueError("quantity %d is above the last tier" % qty)
