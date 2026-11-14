def summary(before, after):
    """One line describing a dedupe run."""
    removed = len(before) - len(after)
    return "%d contacts, %d after merging (%d duplicates removed)" % (len(before), len(after), removed)
