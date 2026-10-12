import base64
import json
import os
import unittest

from buildaduck import duck_format
from buildaduck.duck_format import validate_duck
from buildaduck.loader import load_duck_text, parse_json, read_json

PARITY = os.path.join(os.path.dirname(__file__), "parity.json")


def as_json(value):
    """JSON text as JavaScript would print it: whole floats as ints, key order kept."""
    def norm(v):
        if isinstance(v, float) and v.is_integer():
            return int(v)
        if isinstance(v, dict):
            return {k: norm(x) for k, x in v.items()}
        if isinstance(v, list):
            return [norm(x) for x in v]
        return v
    return json.dumps(norm(value))


def classic():
    return read_json("classic.duck.json")


def text_of(change):
    duck = classic()
    change(duck)
    return json.dumps(duck)


def reason_of(text):
    ok, reason = validate_duck(parse_json(text))
    assert not ok, "expected the duck to be refused"
    return reason


class ParityTest(unittest.TestCase):
    def test_every_format_case(self):
        with open(PARITY, encoding="utf-8") as file:
            cases = json.load(file)["format"]
        self.assertGreaterEqual(len(cases), 44)
        reasons = set()
        for case in cases:
            with self.subTest(case["name"]):
                ok, result = validate_duck(case["input"])
                got = {"ok": True, "duck": result} if ok else {"ok": False, "reason": result}
                # Compared as text, so key order and true-versus-1 are checked too.
                self.assertEqual(as_json(got), as_json(case["result"]))
                if not ok:
                    reasons.add(result)
        self.assertEqual(reasons, {
            "not-object", "version-newer", "version", "unknown-key", "name", "palette",
            "frames", "animations", "personality", "languages", "roam",
        })
        print(f"format parity entries compared: {len(cases)}")

    def test_input_is_not_changed(self):
        duck = classic()
        del duck["animations"]["carried"]
        before = json.dumps(duck)
        ok, result = validate_duck(duck)
        self.assertTrue(ok)
        self.assertEqual(json.dumps(duck), before)
        result["animations"]["carried"]["seq"].append(1)
        self.assertEqual(result["animations"]["idle"]["seq"], duck["animations"]["idle"]["seq"])

    def test_constants(self):
        self.assertEqual(duck_format.VERSION, 1)
        self.assertEqual(duck_format.FRAME_BYTES, 1024)
        self.assertEqual((duck_format.MAX_FRAMES, duck_format.MAX_COLOURS), (20, 15))
        self.assertEqual((duck_format.MAX_NAME, duck_format.MAX_SEQ), (24, 8))
        self.assertEqual(duck_format.ANIMATION_NAMES,
                         ["idle", "walk", "squeak", "sleep", "thinking", "carried", "landing"])
        self.assertEqual(duck_format.ROAMS, ["strip", "page", "sit", "path"])
        self.assertEqual(duck_format.LANGUAGES, ["java", "javascript", "python", "c"])


class RawTextTest(unittest.TestCase):
    """What JSON text can say that parity.json, written by JavaScript, cannot carry."""

    def swap(self, text, old, new):
        self.assertIn(old, text)
        return text.replace(old, new, 1)

    def test_whole_floats_are_integers_and_stored_as_ints(self):
        text = json.dumps(classic())
        text = self.swap(text, '"v": 1,', '"v": 1.0,')
        text = self.swap(text, '"seq": [0, 0, 0, 1], "fps": 2,', '"seq": [0.0, 0, 0, 1.0], "fps": 2.0,')
        text = self.swap(text, '"sass": 50,', '"sass": 50.0,')
        text = self.swap(text, '"speed": 50', '"speed": 5e1')
        status, duck = load_duck_text(text)
        self.assertEqual(status, "ok")
        # No normalising here: 2.0 must have become 2.
        self.assertEqual(json.dumps(duck), json.dumps(classic()))
        self.assertIs(type(duck["animations"]["idle"]["fps"]), int)
        self.assertIs(type(duck["personality"]["speed"]), int)

    def test_a_fraction_is_not_an_integer(self):
        text = self.swap(json.dumps(classic()), '"fps": 2,', '"fps": 2.5,')
        self.assertEqual(reason_of(text), "animations")

    def test_booleans_are_never_numbers(self):
        text = json.dumps(classic())
        self.assertEqual(reason_of(self.swap(text, '"v": 1,', '"v": true,')), "version")
        self.assertEqual(load_duck_text(self.swap(text, '"v": 1,', '"v": true,')), ("error", "invalid"))
        self.assertEqual(reason_of(self.swap(text, '"fps": 2,', '"fps": true,')), "animations")
        self.assertEqual(reason_of(self.swap(text, '"seq": [0, 0, 0, 1]', '"seq": [false, 0, 0, true]')), "animations")
        zero = text_of(lambda d: d["personality"].update(sass=0, speed=0))
        self.assertEqual(load_duck_text(zero)[0], "ok")
        self.assertEqual(reason_of(self.swap(zero, '"sass": 0,', '"sass": false,')), "personality")
        self.assertEqual(reason_of(self.swap(zero, '"speed": 0', '"speed": false')), "personality")

    def test_nan_and_infinity_are_not_json(self):
        text = json.dumps(classic())
        for constant in ("NaN", "Infinity", "-Infinity"):
            with self.subTest(constant):
                bad = self.swap(text, '"sass": 50,', f'"sass": {constant},')
                with self.assertRaises(ValueError):
                    parse_json(bad)
                self.assertEqual(load_duck_text(bad), ("error", "not-json"))

    def test_a_number_too_large_for_a_double_is_not_an_integer(self):
        text = json.dumps(classic())
        self.assertEqual(reason_of(self.swap(text, '"v": 1,', '"v": 1e400,')), "version")
        self.assertEqual(reason_of(self.swap(text, '"v": 1,', f'"v": 1{"0" * 400},')), "version")

    def test_colour_with_a_trailing_newline(self):
        text = text_of(lambda d: d["palette"].__setitem__(0, d["palette"][0] + "\n"))
        self.assertIn("\\n", text)
        self.assertEqual(reason_of(text), "palette")

    def frame_result(self, frame):
        def change(d):
            d["frames"][0] = frame
        ok, result = validate_duck(parse_json(text_of(change)))
        return "ok" if ok else result

    def test_base64_as_atob_reads_it(self):
        padded = base64.b64encode(bytes(1024)).decode("ascii")
        self.assertEqual(len(padded), 1368)
        self.assertTrue(padded.endswith("=="))
        bare = padded[:-2]
        self.assertEqual(len(bare), 1366)
        self.assertEqual(self.frame_result(bare), "ok")
        self.assertEqual(self.frame_result(padded), "ok")
        self.assertEqual(self.frame_result(bare + "="), "frames")    # 1,367 with one =
        self.assertEqual(self.frame_result(bare[:-1]), "frames")     # 1,365
        # atob drops the spare bits of the last character without looking at them.
        self.assertEqual(self.frame_result(bare[:-1] + "B"), "ok")
        self.assertEqual(self.frame_result(bare[:-1] + "B=="), "ok")
        # A newline after the padding passes Python's `$` but not JavaScript's.
        self.assertEqual(self.frame_result(padded + "\n"), "frames")
        self.assertEqual(self.frame_result(bare[:683] + "=" + bare[683:]), "frames")
        self.assertEqual(self.frame_result(bare[:-1] + "-"), "frames")
        self.assertEqual(self.frame_result(""), "frames")

    def test_base64_lengths_around_a_frame(self):
        for count, expected in ((1023, "frames"), (1024, "ok"), (1025, "frames")):
            padded = base64.b64encode(bytes(count)).decode("ascii")
            with self.subTest(count):
                self.assertEqual(self.frame_result(padded), expected)
                self.assertEqual(self.frame_result(padded.rstrip("=")), expected)

    def test_languages_holding_a_list_or_object(self):
        for entry in ('[["java"]]', '[[]]', '[{}]', '[["java"], ["java"]]', '[1, 1]', '[null]'):
            with self.subTest(entry):
                text = self.swap(json.dumps(classic()), '"languages": []', f'"languages": {entry}')
                self.assertEqual(reason_of(text), "languages")

    def test_name_is_measured_in_utf16_code_units(self):
        duck_emoji = "\U0001f986"
        self.assertEqual(reason_of(text_of(lambda d: d.update(name=duck_emoji * 24))), "name")
        self.assertEqual(reason_of(text_of(lambda d: d.update(name=duck_emoji * 13))), "name")
        status, duck = load_duck_text(text_of(lambda d: d.update(name=duck_emoji * 12)))
        self.assertEqual((status, duck["name"]), ("ok", duck_emoji * 12))
        # A lone surrogate is one code unit and must not raise.
        lone = self.swap(json.dumps(classic()), '"name": "Classic"', '"name": "\\ud83e"')
        self.assertEqual(load_duck_text(lone)[0], "ok")

    def test_name_is_trimmed_as_javascript_trims(self):
        def name_after(name):
            status, duck = load_duck_text(text_of(lambda d: d.update(name=name)))
            self.assertEqual(status, "ok")
            return duck["name"]
        self.assertEqual(name_after(" Quackers "), "Quackers")
        self.assertEqual(name_after("﻿ 　 Quackers\t\v\f\r\n     "), "Quackers")
        # Python's strip() would remove these; JavaScript's trim() does not.
        for kept in ("\x1c", "\x1d", "\x1e", "\x1f", "\x85", "​", "᠎"):
            with self.subTest(repr(kept)):
                self.assertEqual(name_after(kept + "Quackers" + kept), kept + "Quackers" + kept)
        # Padding does not count towards the limit.
        self.assertEqual(name_after(" " * 5 + "x" * 24 + "﻿" * 5), "x" * 24)


if __name__ == "__main__":
    unittest.main()
