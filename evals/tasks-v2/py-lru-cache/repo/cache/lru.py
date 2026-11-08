import time
from collections import OrderedDict


class LRUCache:
    """Least-recently-used cache with an optional time-to-live.

    get() and put() both count as a use of that key. When the cache is over capacity, put()
    evicts the least recently used entry. If ttl is set, an entry stored more than ttl seconds
    ago is treated as missing (and removed).
    """

    def __init__(self, capacity, ttl=None, clock=time.monotonic):
        self.capacity = capacity
        self.ttl = ttl
        self.clock = clock
        self.data = OrderedDict()

    def get(self, key, default=None):
        if key not in self.data:
            return default
        value, stamp = self.data[key]
        if self.ttl is not None and self.clock() - stamp < self.ttl:
            del self.data[key]
            return default
        return value

    def put(self, key, value):
        self.data[key] = (value, self.clock())
        if len(self.data) > self.capacity:
            self.data.popitem(last=True)
