Bug report from the operations team: in the daily report made by `python3 -m pipeline.cli`, readings
from stations outside UTC are counted on the wrong day, and some stations' daily means are far too
high. Stations that send UTC ("Z") timestamps in Celsius look fine. The existing tests pass.
Find and fix the causes so that the code behaves as its docstrings describe, and keep the report
format unchanged. Do not edit the tests.
