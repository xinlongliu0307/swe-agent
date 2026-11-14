import re

TOKEN = re.compile(r"\{\{\s*(.*?)\s*\}\}")


def tokens(text):
    """Split a template into ("text", s) and ("var", expression) tokens."""
    out, pos = [], 0
    for m in TOKEN.finditer(text):
        if m.start() > pos:
            out.append(("text", text[pos:m.start()]))
        out.append(("var", m.group(1)))
        pos = m.end()
    if pos < len(text):
        out.append(("text", text[pos:]))
    return out
