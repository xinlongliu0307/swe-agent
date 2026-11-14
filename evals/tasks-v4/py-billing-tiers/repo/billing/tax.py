from .config import TAX_PERCENT


def tax_cents(net_cents):
    """Tax on a net amount, rounded half up to a whole cent."""
    return (net_cents * TAX_PERCENT + 50) // 100
