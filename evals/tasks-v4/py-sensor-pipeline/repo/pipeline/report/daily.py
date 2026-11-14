from ..config import DECIMALS


def daily_means(readings):
    """{(station, 'YYYY-MM-DD'): mean Celsius} per UTC day, rounded to DECIMALS."""
    groups = {}
    for r in readings:
        groups.setdefault((r.station, r.time.strftime("%Y-%m-%d")), []).append(r.celsius)
    return {k: round(sum(v) / len(v), DECIMALS) for k, v in groups.items()}
