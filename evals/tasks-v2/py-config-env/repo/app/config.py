import configparser

DEFAULTS = {"server": {"host": "127.0.0.1", "port": "8000"}, "log": {"level": "INFO"}}


def load(path=None):
    """Return settings as {section: {key: value}}: DEFAULTS, then the INI file at `path` if given."""
    cfg = configparser.ConfigParser()
    cfg.read_dict(DEFAULTS)
    if path:
        cfg.read(path)
    return {s: dict(cfg[s]) for s in cfg.sections()}
