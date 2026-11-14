from .models import FIELDS
from .normalize import norm_email, norm_phone


def merge_fields(people):
    """One contact from a group: for each field, the first non-empty value in input order."""
    return {f: next((p.get(f) for p in people if p.get(f)), "") for f in FIELDS}


def dedupe(contacts):
    """Merge contacts that are the same person, directly or through a chain of matches.

    Each group is merged with merge_fields, taking its members in input order. Groups are
    returned in the order of their first member in the input.
    """
    parent = list(range(len(contacts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    first = {}  # normalised key -> index of the first contact that has it
    for i, c in enumerate(contacts):
        for key in (("email", norm_email(c.get("email"))), ("phone", norm_phone(c.get("phone")))):
            if not key[1]:
                continue
            if key in first:
                a, b = find(first[key]), find(i)
                if a != b:
                    parent[max(a, b)] = min(a, b)
            else:
                first[key] = i
    groups = {}
    for i in range(len(contacts)):
        groups.setdefault(find(i), []).append(i)
    ordered = sorted(groups.values(), key=lambda g: g[0])
    return [merge_fields([contacts[j] for j in g]) for g in ordered]
