from .models import display_name


def greeting(user):
    return f"Hello, {display_name(user)}!"
