from .normalize import norm_email, norm_phone


def same_person(a, b):
    """True if two contacts share a non-empty normalised email or a non-empty normalised phone."""
    ea, eb = norm_email(a.get("email")), norm_email(b.get("email"))
    if ea and ea == eb:
        return True
    pa, pb = norm_phone(a.get("phone")), norm_phone(b.get("phone"))
    return bool(pa) and pa == pb
