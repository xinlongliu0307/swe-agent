def render(means, skipped=0, dropped=0):
    """Plain-text report: a 'station day mean' line per key, sorted, then a footer line."""
    lines = ["%-8s %s %6.1f" % (station, day, means[(station, day)]) for station, day in sorted(means)]
    lines.append("skipped rows: %d, sensor faults: %d" % (skipped, dropped))
    return "\n".join(lines)
