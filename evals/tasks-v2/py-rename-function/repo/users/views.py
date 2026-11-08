from .models import get_user_name


def greeting(user):
    return f"Hello, {get_user_name(user)}!"
