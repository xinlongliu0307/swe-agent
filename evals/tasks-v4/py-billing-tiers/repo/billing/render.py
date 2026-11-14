from .money import fmt


def render(inv):
    return "\n".join([
        "Invoice for %s (%s plan)" % (inv["customer"], inv["plan"]),
        "Usage: %d units" % inv["qty"],
        "Net:   %s" % fmt(inv["net"]),
        "Tax:   %s" % fmt(inv["tax"]),
        "Total: %s" % fmt(inv["total"]),
    ])
