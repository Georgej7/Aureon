from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared limiter instance — imported by main.py (to register it on the app)
# and by individual route modules (to apply @limiter.limit(...) per route).
# Keyed by IP rather than user id: the goal is blocking request floods, and
# an unauthenticated flood has no user id to key on anyway.
limiter = Limiter(key_func=get_remote_address)
