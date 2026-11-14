# pipeline

Turns weather-station CSV exports into a daily report.

    python3 -m pipeline.cli data/sample.csv [report.txt]

Input columns: station, time (ISO 8601 with an offset), value, unit (C, F or K).
The report lists the mean temperature in Celsius per station and UTC day.
