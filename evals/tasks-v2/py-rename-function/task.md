Rename the function get_user_name to display_name across the whole codebase: every caller must use
display_name. Keep get_user_name importable from users.models as a deprecated alias that returns the
same value and emits a DeprecationWarning. Do not edit the tests.
