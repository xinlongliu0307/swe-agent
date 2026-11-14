Users report three problems with the tmpl package: {{ user.name | upper }} written with spaces around
the | prints "None" instead of the upper-cased name, a misspelt variable silently prints "None"
instead of raising MissingVariable, and a misspelt filter is silently ignored. Make render() behave
as its docstring says. The existing tests pass. Do not edit the tests.
