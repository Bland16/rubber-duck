import json
import os
import unittest

from buildaduck.loader import read_json
from buildaduck.picker import (
    buddy_key, chatter_key, compose_hunches, create_picker, extra_sentence, fill, voice_of,
)

PARITY = os.path.join(os.path.dirname(__file__), "parity.json")
KINDS = {"string", "comment", "bracket", "parse", "semicolon", "assign", "indent"}


def replay(numbers):
    """An rng that hands out the recorded numbers in order, and fails if they run out."""
    left = iter(numbers)
    return lambda: next(left)


class ParityTest(unittest.TestCase):
    def test_every_speech_case(self):
        pool = read_json("responses.json")
        with open(PARITY, encoding="utf-8") as file:
            cases = json.load(file)["speech"]
        self.assertEqual(len(cases), 200)
        seen = set()
        for index, case in enumerate(cases):
            with self.subTest(index):
                duck, result = case["duck"], case["result"]
                picker = create_picker(pool, replay(case["randoms"]))
                self.assertEqual(compose_hunches(result, duck, picker), case["lines"])
                # The same picker again: the shuffle bag and the no-repeat rule.
                self.assertEqual(compose_hunches(result, duck, picker), case["again"][0])
                self.assertEqual(compose_hunches(result, duck, picker), case["again"][1])
                self.assertEqual([chatter_key(duck, False), chatter_key(duck, True)], case["chatterKeys"])
                self.assertEqual(buddy_key(duck), case["buddyKey"])
                self.assertEqual(fill("{name} says line {line}, {name}.", duck, index), case["fill"])
                seen.add(result["status"])
                seen.update(f["kind"] for f in result["findings"])
                if result["status"] == "ok" and not result["findings"]:
                    seen.add("unsure" if result["unsure"] else "clean")
                if any(line.endswith(" more)") for line in case["lines"]):
                    seen.add("more")
        # The cases must between them cover what section 13 promises.
        self.assertEqual(seen, KINDS | {"empty", "too-long", "ok", "unsure", "clean", "more"})
        print(f"speech parity entries compared: {len(cases)}")


class PickerTest(unittest.TestCase):
    def test_unknown_key(self):
        picker = create_picker({"a": ["x"], "empty": [], "text": "x"}, lambda: 0)
        for key in ("missing", "empty", "text"):
            with self.subTest(key):
                with self.assertRaises(LookupError):
                    picker.pick(key)

    def test_deals_every_line_before_repeating(self):
        lines = ["a", "b", "c", "d", "e"]
        numbers = [0.9, 0.1, 0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.0] * 4
        picker = create_picker({"k": lines}, replay(numbers))
        dealt = [picker.pick("k") for _ in range(20)]
        for start in range(0, 20, 5):
            self.assertEqual(sorted(dealt[start:start + 5]), lines)
        self.assertEqual(lines, ["a", "b", "c", "d", "e"])

    def test_never_the_same_line_twice_in_a_row(self):
        # rng always 0 puts the same line last in every shuffle, so only the swap prevents a repeat.
        picker = create_picker({"k": ["a", "b"]}, lambda: 0)
        dealt = [picker.pick("k") for _ in range(8)]
        self.assertTrue(all(x != y for x, y in zip(dealt, dealt[1:])), dealt)

    def test_a_single_line_needs_no_random_number(self):
        picker = create_picker({"k": ["only"]}, replay([]))
        self.assertEqual([picker.pick("k"), picker.pick("k")], ["only", "only"])

    def test_default_rng(self):
        self.assertIn(create_picker({"k": ["a", "b", "c"]}).pick("k"), ["a", "b", "c"])

    def test_fill(self):
        self.assertEqual(fill("{name}: {line}", {"name": ""}, 3), "Duck: 3")
        self.assertEqual(fill("{name}: {line}", {"name": "$& x"}, ""), "$& x: ")
        self.assertEqual(fill("{line}", {"name": "x"}, None), "null")
        self.assertEqual(fill("{line}", {"name": "x"}, 3.0), "3")

    def test_voice_of(self):
        duck = {"name": "x", "personality": {"sass": 90, "energy": 30, "helpfulness": 50, "chattiness": 10}}
        self.assertEqual(voice_of(duck), "goth")


class ExtraSentenceTest(unittest.TestCase):
    JAVASCRIPT = "I can only check JavaScript lightly here."

    def result(self, *findings, status="ok", unsure=False):
        return {"status": status, "findings": list(findings), "unsure": unsure}

    def p6(self, line):
        return {"rule": "P6", "kind": "parse", "line": line}

    def test_single_p6_finding_with_a_line(self):
        self.assertEqual(extra_sentence(self.result(self.p6(12)), "python"), "Python points at line 12.")
        self.assertEqual(extra_sentence(self.result(self.p6(1)), "python"), "Python points at line 1.")

    def test_single_p6_finding_without_a_line(self):
        self.assertEqual(extra_sentence(self.result(self.p6(None)), "python"), "")

    def test_p6_beside_other_findings(self):
        other = {"rule": "R5", "kind": "indent", "line": 3}
        self.assertEqual(extra_sentence(self.result(self.p6(4), other), "python"), "")
        self.assertEqual(extra_sentence(self.result(other, self.p6(4)), "python"), "")
        self.assertEqual(extra_sentence(self.result(self.p6(4), self.p6(5)), "python"), "")

    def test_another_rule_alone(self):
        self.assertEqual(extra_sentence(self.result({"rule": "R1", "kind": "bracket", "line": 4}), "python"), "")

    def test_clean_python(self):
        self.assertEqual(extra_sentence(self.result(), "python"), "")

    def test_clean_javascript(self):
        self.assertEqual(extra_sentence(self.result(), "javascript"), self.JAVASCRIPT)
        # Without the browser's parser a clean JavaScript check is always marked unsure.
        self.assertEqual(extra_sentence(self.result(unsure=True), "javascript"), self.JAVASCRIPT)

    def test_javascript_with_findings(self):
        finding = {"rule": "R7", "kind": "semicolon", "line": 2}
        self.assertEqual(extra_sentence(self.result(finding), "javascript"), "")

    def test_javascript_that_was_not_checked(self):
        self.assertEqual(extra_sentence(self.result(status="empty"), "javascript"), "")
        self.assertEqual(extra_sentence(self.result(status="too-long"), "javascript"), "")

    def test_clean_java_and_c(self):
        self.assertEqual(extra_sentence(self.result(), "java"), "")
        self.assertEqual(extra_sentence(self.result(), "c"), "")


if __name__ == "__main__":
    unittest.main()
