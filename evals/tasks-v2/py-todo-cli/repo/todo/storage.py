import json
import os


def load(path):
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)


def save(path, items):
    with open(path, "w") as f:
        json.dump(items, f)
