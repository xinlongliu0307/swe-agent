Two bugs reported from the dashboard: (1) when several widgets ask for the same user at the same
time, the backend receives one request per widget instead of one; (2) when someone types quickly
in the search box, the results of an earlier query sometimes replace those of the latest query.
Fix both. Concurrent ApiClient.getUser calls for the same id must share one backend request, and a
failed request must not be cached (the next call tries again). SearchBox.results and the
SearchBox.changes event must only ever show results for the latest query. The existing tests pass.
Do not edit the tests.
