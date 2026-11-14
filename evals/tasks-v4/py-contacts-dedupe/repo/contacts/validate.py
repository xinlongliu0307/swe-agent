import re

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def problems(contact):
    """Human-readable problems with one contact (empty list when fine)."""
    out = []
    if not (contact.get("email") or contact.get("phone")):
        out.append("no email or phone")
    if contact.get("email") and not EMAIL.match(contact["email"].strip()):
        out.append("invalid email: " + contact["email"])
    return out
