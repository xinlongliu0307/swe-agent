import configparser
import os

DEFAULTS = {"server": {"host": "127.0.0.1", "port": "8000"}, "log": {"level": "INFO"}}


def load(path=None, env=None):
    """Return settings as {section: {key: value}}: DEFAULTS, then the INI file, then APP_<SECTION>_<KEY>."""
    env = os.environ if env is None else env
    cfg = configparser.ConfigParser()
    cfg.read_dict(DEFAULTS)
    if path:
        cfg.read(path)
    out = {s: dict(cfg[s]) for s in cfg.sections()}
    for section, values in out.items():
        for key in values:
            name = f"APP_{section.upper()}_{key.upper()}"
            if name in env:
                values[key] = env[name]
    return out
