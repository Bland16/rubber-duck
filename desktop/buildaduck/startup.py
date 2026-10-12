"""Which duck to show first. Pure: the loader and the Classic duck are passed in."""

import os


def choose_duck(args, config, load, classic):
    """Returns (duck, source, error_key).

    args is the command line after the program's name. source is "argument", "remembered"
    or "classic". error_key is the loader's key when a command-line file was given and did
    not load, else None.
    """
    error_key = None
    if args:
        status, value = load(os.path.abspath(args[0]))
        if status == "ok":
            return value, "argument", None
        error_key = value
    remembered = config.get("duckPath")
    if remembered:
        status, value = load(remembered)
        if status == "ok":
            return value, "remembered", error_key
    return classic, "classic", error_key
