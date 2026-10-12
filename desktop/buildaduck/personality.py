"""Sliders -> trait words, personality label, buddy mode and behaviour numbers. Pure.

A port of js/personality.js.
"""

SLIDER_INFO = [
    {"key": "sass", "label": "Sass", "words": ["Polite", "Dry", "Savage"]},
    {"key": "energy", "label": "Energy", "words": ["Sleepy", "Steady", "Zoomy"]},
    {"key": "helpfulness", "label": "Helpfulness", "words": ["Cryptic", "Fair", "Mentor"]},
    {"key": "chattiness", "label": "Chattiness", "words": ["Quiet", "Chatty", "Never stops"]},
    {"key": "codeFocus", "label": "Code focus", "words": ["Casual", "Curious", "Obsessed"]},
]

# Walking speed is not a trait: it has no word in trait_words and does not affect the label.
SPEED_INFO = {"key": "speed", "label": "Walking speed", "words": ["Slow", "Medium", "Fast"]}

# Centres are (sass, energy, helpfulness, chattiness). Earlier rows win ties.
PERSONALITIES = [
    {"voice": "senior", "label": "Senior Engineer", "centre": [70, 20, 70, 50]},
    {"voice": "hype", "label": "Hype Duck", "centre": [10, 90, 80, 80]},
    {"voice": "chaos", "label": "Chaos Duck", "centre": [80, 80, 10, 70]},
    {"voice": "goth", "label": "Goth Duck", "centre": [90, 30, 50, 10]},
]


def band(value):
    """0 for 0-30, 1 for 35-65, 2 for 70-100."""
    return 0 if value <= 30 else 1 if value <= 65 else 2


def trait_words(p):
    return [info["words"][band(p[info["key"]])] for info in SLIDER_INFO]


def personality_of(p):
    point = [p["sass"], p["energy"], p["helpfulness"], p["chattiness"]]
    best = PERSONALITIES[0]
    best_distance = float("inf")
    for candidate in PERSONALITIES:
        distance = sum((c - point[i]) ** 2 for i, c in enumerate(candidate["centre"]))
        if distance < best_distance:
            best = candidate
            best_distance = distance
    return best


def label(p):
    return personality_of(p)["label"]


def is_buddy(p):
    return p["codeFocus"] == 0


def sass_level(p):
    return "mild" if p["sass"] < 50 else "spicy"


def behaviour(p):
    return {
        "idlePauseMs": 4000 - 30 * p["energy"],
        "walkSpeed": 20 + (p["speed"] if "speed" in p else p["energy"]),
        "sleepAfterMs": 20000 + 400 * p["energy"],
        "chatterEveryMs": None if p["chattiness"] == 0 else 60000 - 500 * p["chattiness"],
        "codeChatterChance": p["codeFocus"] / 100,
    }
