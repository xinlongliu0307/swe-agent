def write_text(path, text):
    """Write text to path, ending with exactly one newline."""
    with open(path, "w") as f:
        f.write(text.rstrip("\n") + "\n")
