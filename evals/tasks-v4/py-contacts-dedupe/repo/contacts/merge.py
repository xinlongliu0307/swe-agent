from .match import same_person
from .models import FIELDS


def merge_fields(people):
    """One contact from a group: for each field, the first non-empty value in input order."""
    return {f: next((p.get(f) for p in people if p.get(f)), "") for f in FIELDS}


def dedupe(contacts):
    """Merge contacts that are the same person, directly or through a chain of matches.

    Each group is merged with merge_fields, taking its members in input order. Groups are
    returned in the order of their first member in the input.
    """
    groups = []
    for i, c in enumerate(contacts):
        hits = [g for g in groups if any(same_person(contacts[j], c) for j in g)]
        merged = [i]
        for g in hits:
            merged.extend(g)
            groups.remove(g)
        groups.append(sorted(merged))
    groups.sort(key=lambda g: g[0])
    return [merge_fields([contacts[j] for j in g]) for g in groups]
