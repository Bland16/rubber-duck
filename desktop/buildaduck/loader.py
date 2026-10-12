"""Reads a .duck.json file, and the data files packaged with the program."""

import json
from importlib import resources

from .duck_format import validate_duck

MAX_FILE_BYTES = 2_000_000

MESSAGES = {
    "unreadable": "That file could not be opened.",
    "not-json": "That file is not a duck file.",
    "newer": "That duck was made by a newer Build-a-Duck. Download the desktop duck again from the site.",
    "invalid": "That file is not a duck this version understands.",
}


def read_data(name):
    """The text of a file in the package's data folder. Works from the .pyzw file too."""
    return (resources.files("buildaduck") / "data" / name).read_text(encoding="utf-8")


def read_json(name):
    return json.loads(read_data(name))


def _reject_constant(name):
    raise ValueError(f"{name} is not JSON")


def parse_json(text):
    """JSON as JavaScript's JSON.parse reads it. Raises ValueError for anything else."""
    if text.startswith("﻿"):
        text = text[1:]
    try:
        # Python would accept NaN, Infinity and -Infinity; JSON.parse does not.
        return json.loads(text, parse_constant=_reject_constant)
    except RecursionError as error:
        raise ValueError("nested too deeply") from error


def load_duck_text(text):
    """The loader's steps after reading and decoding: ("ok", duck) or ("error", key)."""
    try:
        value = parse_json(text)
    except ValueError:
        return "error", "not-json"
    ok, result = validate_duck(value)
    if ok:
        return "ok", result
    return "error", "newer" if result == "version-newer" else "invalid"


def load_duck_file(path):
    try:
        with open(path, "rb") as file:
            # One byte past the limit is enough to know the file is too large.
            data = file.read(MAX_FILE_BYTES + 1)
    except OSError:
        return "error", "unreadable"
    if len(data) > MAX_FILE_BYTES:
        return "error", "not-json"
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return "error", "not-json"
    return load_duck_text(text)
