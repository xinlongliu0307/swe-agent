def hourly(readings):
    """Mean Celsius per (station, start of the UTC hour). Used by the hourly chart."""
    buckets = {}
    for r in readings:
        key = (r.station, r.time.replace(minute=0, second=0, microsecond=0))
        buckets.setdefault(key, []).append(r.celsius)
    return {k: sum(v) / len(v) for k, v in buckets.items()}
