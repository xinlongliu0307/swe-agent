from .config import load


def server_address(path=None):
    s = load(path)["server"]
    return s["host"], int(s["port"])
