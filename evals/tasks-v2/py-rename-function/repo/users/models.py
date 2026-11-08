class User:
    def __init__(self, first, last):
        self.first = first
        self.last = last


def get_user_name(user):
    return f"{user.first} {user.last}"
