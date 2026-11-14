from .catalog import get_plan
from .tax import tax_cents
from .tiers import tiered_price


def build_invoice(customer, plan_name, qty):
    """Invoice as a dict: customer, plan, qty, net, tax and total in cents."""
    plan = get_plan(plan_name)
    net = tiered_price(qty, plan.tiers)
    tax = tax_cents(net)
    return {"customer": customer, "plan": plan.name, "qty": qty, "net": net, "tax": tax, "total": net + tax}
