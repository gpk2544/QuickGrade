import time
import functools
from utils.logger import get_logger
log = get_logger("retry")
def retry(max_attempts: int = 3, backoff: float = 1.5, exceptions=(Exception,)):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            delay = backoff
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as exc:
                    last_exc = exc
                    if attempt < max_attempts:
                        log.warning(
                            "%s attempt %d/%d failed: %s — retrying in %.1fs",
                            fn.__qualname__, attempt, max_attempts, exc, delay,
                        )
                        time.sleep(delay)
                        delay *= 2
                    else:
                        log.error(
                            "%s failed after %d attempts: %s",
                            fn.__qualname__, max_attempts, exc,
                        )
            raise last_exc  
        return wrapper
    return decorator