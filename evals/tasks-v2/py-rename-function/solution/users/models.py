import warnings


class User:
    def __init__(self, first, last):
        self.first = first
        self.last = last


def display_name(user):
    return f"{user.first} {user.last}"


def get_user_name(user):
    warnings.warn("get_user_name is deprecated; use display_name", DeprecationWarning, stacklevel=2)
    return display_name(user)
