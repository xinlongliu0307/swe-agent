from .filters import FILTERS
from .lexer import tokens


class MissingVariable(KeyError):
    pass


def lookup(context, name):
    """Resolve a dotted name like 'user.name' through nested dicts. Raises MissingVariable(name)."""
    value = context
    for part in name.split("."):
        if not isinstance(value, dict) or part not in value:
            raise MissingVariable(name)
        value = value[part]
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
        parts = [p.strip() for p in value.split("|")]
        name, filters = parts[0], parts[1:]
        v = lookup(context, name)
        result = "" if v is None else str(v)
        for f in filters:
            if f not in FILTERS:
                raise ValueError("unknown filter: " + f)
            result = FILTERS[f](result)
        out.append(result)
    return "".join(out)
