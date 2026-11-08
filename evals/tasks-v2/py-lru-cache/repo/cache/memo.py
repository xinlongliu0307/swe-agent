from functools import wraps

from .lru import LRUCache


def memoize(capacity=128, ttl=None):
    def deco(fn):
        cache = LRUCache(capacity, ttl)
        missing = object()

        @wraps(fn)
        def wrapper(*args):
            hit = cache.get(args, missing)
            if hit is not missing:
                return hit
            value = fn(*args)
            cache.put(args, value)
            return value

        wrapper.cache = cache
        return wrapper

    return deco
