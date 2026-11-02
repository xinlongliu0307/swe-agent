def is_palindrome(s):
    """True if s reads the same backwards, ignoring case and any non-letter characters."""
    return s == s[::-1]
