"""Settings shared by the pipeline."""

DECIMALS = 1  # rounding of reported means
MIN_VALID_C = -90.0  # readings outside this range are sensor faults
MAX_VALID_C = 60.0
CSV_COLUMNS = ("station", "time", "value", "unit")
