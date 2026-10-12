"""Chooses what the duck says. Pure: the pool and the random source are passed in.

A port of js/response-picker.js, plus extra_sentence, which is the desktop duck's own.
"""

import math
import random
from types import SimpleNamespace

from .personality import band, personality_of, sass_level

DETAILS = ["vague", "line", "fix"]

JAVASCRIPT_SENTENCE = "I can only check JavaScript lightly here."


def create_picker(pool, rng=random.random):
    """pick(key) deals each key's lines from a shuffled copy, reshuffling only when all
    have been dealt, and never repeats a line twice in a row."""
    decks = {}
    last = {}

    def shuffled(lines):
        deck = list(lines)
        for i in range(len(deck) - 1, 0, -1):
            j = math.floor(rng() * (i + 1))
            deck[i], deck[j] = deck[j], deck[i]
        return deck

    def pick(key):
        lines = pool.get(key)
        if not isinstance(lines, list) or not lines:
            raise LookupError(f"Unknown response key: {key}")
        deck = decks.get(key)
        if not deck:
            deck = shuffled(lines)
            # Dealt from the end, so the next line out is the last entry.
            if len(deck) > 1 and deck[-1] == last.get(key):
                deck[-1], deck[-2] = deck[-2], deck[-1]
            decks[key] = deck
        line = deck.pop()
        last[key] = line
        return line

    return SimpleNamespace(pick=pick)


def _js_string(value):
    # JavaScript's String(): the line is a number, null or an empty string.
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def fill(template, duck, line):
    return template.replace("{name}", duck["name"] or "Duck").replace("{line}", _js_string(line))


def voice_of(duck):
    return personality_of(duck["personality"])["voice"]


def compose_hunches(result, duck, picker):
    """Turns a check_code result into the 1 to 3 strings the duck says, in order."""
    voice = voice_of(duck)

    def state(name):
        return [fill(picker.pick(f"state.{voice}.{name}"), duck, "")]

    if result["status"] == "empty":
        return state("empty")
    if result["status"] == "too-long":
        return state("toolong")
    findings = result["findings"]
    if not findings:
        return state("unsure" if result["unsure"] else "clean")

    helpfulness = band(duck["personality"]["helpfulness"])
    sass = sass_level(duck["personality"])
    shown = findings[: helpfulness + 1]
    hunches = []
    for finding in shown:
        line = finding.get("line")
        detail = "vague" if finding["kind"] == "parse" or line is None else DETAILS[helpfulness]
        hunches.append(fill(picker.pick(f"hunch.{voice}.{finding['kind']}.{sass}.{detail}"), duck, line))
    left = len(findings) - len(shown)
    if left > 0:
        hunches[-1] += f" (+{left} more)"
    return hunches


def chatter_key(duck, about_code):
    return f"chatter.{voice_of(duck)}.{sass_level(duck['personality'])}.{'code' if about_code else 'general'}"


def buddy_key(duck):
    return f"buddy.{voice_of(duck)}"


def extra_sentence(result, language):
    """The fixed sentence to put after the duck's lines, or an empty string."""
    if result["status"] != "ok":
        return ""
    findings = result["findings"]
    # Without the browser's parser a JavaScript check that finds nothing proves little.
    if not findings:
        return JAVASCRIPT_SENTENCE if language == "javascript" else ""
    if len(findings) == 1 and findings[0]["rule"] == "P6" and findings[0].get("line") is not None:
        return f"Python points at line {_js_string(findings[0]['line'])}."
    return ""
