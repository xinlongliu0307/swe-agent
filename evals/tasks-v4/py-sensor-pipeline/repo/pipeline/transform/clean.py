from ..config import MAX_VALID_C, MIN_VALID_C


def drop_faults(readings):
    """Remove readings outside the plausible range. Returns (kept, number dropped)."""
    kept = [r for r in readings if MIN_VALID_C <= r.celsius <= MAX_VALID_C]
    return kept, len(readings) - len(kept)


def drop_duplicates(readings):
    """Keep the first reading for each (station, time)."""
    seen, out = set(), []
    for r in readings:
        key = (r.station, r.time)
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out
