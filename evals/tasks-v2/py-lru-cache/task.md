The LRU cache in cache/lru.py (used by the memoize decorator in cache/memo.py) evicts the wrong entries
and handles expiry incorrectly. Fix it so it behaves exactly as the LRUCache docstring describes.
Do not edit the tests.
