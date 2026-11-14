def norm_email(email):
    """Lower-cased and stripped; '' for a missing email."""
    return (email or "").strip().lower()


def norm_phone(phone):
    """Digits only; an 11-digit number starting with country code 61 becomes 0 + national number."""
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if len(digits) == 11 and digits.startswith("61"):
        digits = "0" + digits[2:]
    return digits
