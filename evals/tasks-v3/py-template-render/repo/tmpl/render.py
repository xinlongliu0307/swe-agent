from .filters import FILTERS
from .lexer import tokens


class MissingVariable(KeyError):
    pass


def lookup(context, name):
    """Resolve a dotted name like 'user.name' through nested dicts."""
    value = context
    for part in name.split("."):
        value = value.get(part) if isinstance(value, dict) else None
    return value


def render(text, context):
    """Render {{ name }} and {{ name | filter | filter }} placeholders.

    Names may be dotted (user.name) to look into nested dicts. Spaces around names and | are allowed.
    A missing variable raises MissingVariable(name), a None value renders as an empty string, and an
    unknown filter raises ValueError.
    """
    out = []
    for kind, value in tokens(text):
        if kind == "text":
            out.append(value)
            continue
        name, *filters = value.split("|")
        result = str(lookup(context, name))
        for f in filters:
            result = FILTERS.get(f, lambda s: s)(result)
        out.append(result)
    return "".join(out)
