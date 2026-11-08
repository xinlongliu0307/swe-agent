from users.models import display_name


def roster(users):
    return "\n".join(sorted(display_name(u) for u in users))
