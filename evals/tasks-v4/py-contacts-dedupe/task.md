Importing a CRM export of 20,000 contacts takes many minutes, almost all of it in
contacts.merge.dedupe. Make dedupe handle 20,000 contacts in a few seconds at most, without changing
its results in any way: the same groups, the same merged fields and the same order, for every input.
The existing tests pass and must keep passing. Do not edit the tests.
