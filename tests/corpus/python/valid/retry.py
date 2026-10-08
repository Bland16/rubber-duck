# covers: keyword arguments in an if condition; slices
import time


def is_close(a, b, tolerance=1e-9):
    return abs(a - b) <= tolerance


def wait_until(predicate, timeout=5.0, interval=0.1):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def settle(readings):
    """Return the first reading that matches the one after it."""
    for prev, cur in zip(readings, readings[1:]):
        if is_close(prev, cur, tolerance=0.01):
            return cur
    if not wait_until(lambda: len(readings) > 10, timeout=0.5):
        raise TimeoutError("readings never settled")
    return readings[-1]


if __name__ == "__main__":
    print(settle([1.0, 1.5, 1.52, 1.521, 1.5211]))
