from users.models import get_user_name


def roster(users):
    return "\n".join(sorted(get_user_name(u) for u in users))
