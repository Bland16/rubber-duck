"""The settings file, config.json. The folder is an argument so tests can use their own."""

import json
import os

FILE_NAME = "config.json"
SIZES = ["small", "medium", "large"]
DEFAULTS = {"v": 1, "duckPath": None, "muted": False, "paused": False, "size": "medium"}


def default_folder():
    roaming = os.environ.get("APPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Roaming")
    return os.path.join(roaming, "BuildADuck")


def _valid(key, value):
    if key == "duckPath":
        return value is None or (isinstance(value, str) and os.path.isabs(value))
    if key == "size":
        return isinstance(value, str) and value in SIZES
    return isinstance(value, bool)


def load_config(folder):
    """Always returns a full settings dict; anything wrong in the file gives the default."""
    config = dict(DEFAULTS)
    try:
        with open(os.path.join(folder, FILE_NAME), "r", encoding="utf-8-sig") as file:
            stored = json.load(file)
    except (OSError, ValueError, RecursionError):
        return config
    # A file from an unknown version may mean something else by the same keys.
    if not isinstance(stored, dict) or type(stored.get("v")) is not int or stored["v"] != DEFAULTS["v"]:
        return config
    for key in ("duckPath", "muted", "paused", "size"):
        if key in stored and _valid(key, stored[key]):
            config[key] = stored[key]
    return config


def save_config(folder, config):
    """Returns False when the folder cannot be created or written; the program carries on."""
    stored = {key: config.get(key, default) for key, default in DEFAULTS.items()}
    stored["v"] = DEFAULTS["v"]
    try:
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, FILE_NAME), "w", encoding="utf-8") as file:
            json.dump(stored, file)
    except (OSError, TypeError, ValueError):
        return False
    return True
