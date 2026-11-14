FIELDS = ("name", "email", "phone", "company")


def make_contact(**fields):
    """A contact dict with every field present ('' when missing)."""
    unknown = set(fields) - set(FIELDS)
    if unknown:
        raise TypeError("unknown fields: " + ", ".join(sorted(unknown)))
    return {f: fields.get(f) or "" for f in FIELDS}
