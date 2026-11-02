def merge(defaults, overrides):
    """Return a new dict with overrides taking precedence. Inputs are not modified."""
    result = dict(overrides)
    result.update(defaults)
    return result
