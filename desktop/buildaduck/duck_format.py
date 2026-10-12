"""The duck dictionary: constants and validation. A port of validateDuck in js/duck-format.js."""

import binascii
import re

VERSION = 1
SIZE = 32
FRAME_BYTES = SIZE * SIZE
MAX_FRAMES = 20
MAX_COLOURS = 15
MAX_NAME = 24
MAX_SEQ = 8
ANIMATION_NAMES = ["idle", "walk", "squeak", "sleep", "thinking", "carried", "landing"]
# The first five are required. A duck without the rest gets a copy of its idle animation.
CORE_ANIMATIONS = 5
MOTIONS = ["none", "bob", "hop", "shake"]
SLIDERS = ["sass", "energy", "helpfulness", "chattiness", "codeFocus"]
# A duck without a walking speed walks at its energy.
SPEED = "speed"
LANGUAGES = ["java", "javascript", "python", "c"]
ROAMS = ["strip", "page", "sit", "path"]

TOP_KEYS = ["v", "name", "palette", "frames", "animations", "personality", "languages", "roam"]
ANIMATION_KEYS = ["seq", "fps", "motion"]

# What JavaScript's trim() removes: ECMAScript WhiteSpace and LineTerminator. Python's
# strip() differs (it removes U+001C to U+001F and U+0085, and keeps U+FEFF).
JS_WHITESPACE = (
    "\t\n\v\f\r   "
    "           "
    "    　﻿"
)

_COLOUR = re.compile(r"#[0-9a-f]{6}")
_BASE64 = re.compile(r"[A-Za-z0-9+/]*={0,2}")


def js_trim(text):
    return text.strip(JS_WHITESPACE)


def utf16_length(text):
    # JavaScript's string length. surrogatepass: JSON can carry a lone surrogate.
    return len(text.encode("utf-16-le", "surrogatepass")) // 2


def is_integer(value):
    """Number.isInteger: a whole number of either Python type, and never a boolean."""
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        # An integer too large for a double is Infinity in JavaScript.
        try:
            float(value)
        except OverflowError:
            return False
        return True
    return isinstance(value, float) and value.is_integer()


def _is_object(value):
    return isinstance(value, dict)


def _is_int(value, lo, hi):
    return is_integer(value) and lo <= value <= hi


def _has_unknown(obj, allowed):
    return any(key not in allowed for key in obj)


def frame_to_bytes(frame):
    """Decodes as the browser's atob does. Raises ValueError where atob throws."""
    if len(frame) % 4 == 0:
        if frame.endswith("=="):
            frame = frame[:-2]
        elif frame.endswith("="):
            frame = frame[:-1]
    # Padding is only removed from a length that is a multiple of 4; any left is an error.
    if "=" in frame or len(frame) % 4 == 1:
        raise ValueError("not base64")
    try:
        return binascii.a2b_base64(frame + "=" * (-len(frame) % 4))
    except binascii.Error as error:
        raise ValueError("not base64") from error


def _valid_frame(frame, colours):
    if not isinstance(frame, str) or not _BASE64.fullmatch(frame):
        return False
    try:
        data = frame_to_bytes(frame)
    except ValueError:
        return False
    return len(data) == FRAME_BYTES and all(b <= colours for b in data)


def _valid_animation(a, frame_count):
    if not _is_object(a):
        return False
    seq = a.get("seq")
    if not isinstance(seq, list) or len(seq) < 1 or len(seq) > MAX_SEQ:
        return False
    if not all(_is_int(i, 0, frame_count - 1) for i in seq):
        return False
    motion = a.get("motion")
    return _is_int(a.get("fps"), 1, 12) and isinstance(motion, str) and motion in MOTIONS


def _step_of_five(value):
    return _is_int(value, 0, 100) and value % 5 == 0


def validate_duck(value):
    """Returns (True, duck) with a normalised copy, or (False, reason)."""
    if not _is_object(value):
        return False, "not-object"
    v = value.get("v")
    if is_integer(v) and v > VERSION:
        return False, "version-newer"
    # is_integer first: True == 1 in Python, and true is not a version.
    if not (is_integer(v) and v == VERSION):
        return False, "version"

    if _has_unknown(value, TOP_KEYS):
        return False, "unknown-key"
    animations = value.get("animations")
    if _is_object(animations):
        if _has_unknown(animations, ANIMATION_NAMES):
            return False, "unknown-key"
        if any(_is_object(a) and _has_unknown(a, ANIMATION_KEYS) for a in animations.values()):
            return False, "unknown-key"
    personality = value.get("personality")
    if _is_object(personality) and _has_unknown(personality, SLIDERS + [SPEED]):
        return False, "unknown-key"

    if not isinstance(value.get("name"), str):
        return False, "name"
    name = js_trim(value["name"])
    if utf16_length(name) > MAX_NAME:
        return False, "name"

    palette = value.get("palette")
    if (not isinstance(palette, list) or len(palette) < 1 or len(palette) > MAX_COLOURS
            or not all(isinstance(c, str) and _COLOUR.fullmatch(c) for c in palette)):
        return False, "palette"

    frames = value.get("frames")
    if (not isinstance(frames, list) or len(frames) < 1 or len(frames) > MAX_FRAMES
            or not all(_valid_frame(f, len(palette)) for f in frames)):
        return False, "frames"

    if not _is_object(animations):
        return False, "animations"
    filled = dict(animations)
    for key in ANIMATION_NAMES[CORE_ANIMATIONS:]:
        # Only a missing key is defaulted; an explicit null is an error, as in JavaScript.
        if key not in filled:
            filled[key] = animations.get("idle")
    for key in ANIMATION_NAMES:
        if not _valid_animation(filled.get(key), len(frames)):
            return False, "animations"

    if not _is_object(personality) or not all(_step_of_five(personality.get(k)) for k in SLIDERS):
        return False, "personality"
    speed = personality[SPEED] if SPEED in personality else personality["energy"]
    if not _step_of_five(speed):
        return False, "personality"

    languages = value.get("languages")
    # The str test comes first so an entry that is a list or object is never hashed.
    if (not isinstance(languages, list)
            or not all(isinstance(l, str) and l in LANGUAGES for l in languages)
            or len(set(languages)) != len(languages)):
        return False, "languages"

    roam = value.get("roam")
    if not isinstance(roam, str) or roam not in ROAMS:
        return False, "roam"

    # Whole-number floats are stored as ints, so the duck prints as JavaScript prints it.
    duck = {
        "v": VERSION,
        "name": name,
        "palette": list(palette),
        "frames": list(frames),
        "animations": {},
        "personality": {},
        "languages": list(languages),
        "roam": roam,
    }
    for key in ANIMATION_NAMES:
        a = filled[key]
        duck["animations"][key] = {"seq": [int(i) for i in a["seq"]], "fps": int(a["fps"]), "motion": a["motion"]}
    for key in SLIDERS:
        duck["personality"][key] = int(personality[key])
    duck["personality"][SPEED] = int(speed)
    return True, duck
