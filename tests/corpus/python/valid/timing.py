# covers: (none) decorators, a generator and type hints
import functools
import time
from typing import Callable, Iterator


def timed(fn: Callable) -> Callable:
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            elapsed = (time.perf_counter() - start) * 1000
            print(f"{fn.__name__} took {elapsed:.2f} ms")
    return wrapper


def primes(limit: int) -> Iterator[int]:
    sieve = [True] * (limit + 1)
    for n in range(2, limit + 1):
        if not sieve[n]:
            continue
        yield n
        for multiple in range(n * n, limit + 1, n):
            sieve[multiple] = False


@timed
def count_primes(limit: int = 10_000) -> int:
    return sum(1 for _ in primes(limit))


@functools.lru_cache(maxsize=None)
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)


if __name__ == "__main__":
    print(count_primes(), fib(40))
