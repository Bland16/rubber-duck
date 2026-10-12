import json
import os
import unittest

from buildaduck import personality
from buildaduck.personality import band, behaviour, is_buddy, label, personality_of, sass_level, trait_words

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


class ParityTest(unittest.TestCase):
    def test_every_personality_case(self):
        with open(PARITY, encoding="utf-8") as file:
            cases = json.load(file)["personality"]
        self.assertEqual(len(cases), 1296 + 300)
        for index, case in enumerate(cases):
            p = case["p"]
            got = {
                "label": label(p),
                "traitWords": trait_words(p),
                "isBuddy": is_buddy(p),
                "sassLevel": sass_level(p),
                "behaviour": behaviour(p),
            }
            expected = {key: case[key] for key in got}
            if as_json(got) != as_json(expected):
                self.fail(f"case {index} {p}: {as_json(got)} != {as_json(expected)}")
        print(f"personality parity entries compared: {len(cases)}")


class PersonalityTest(unittest.TestCase):
    def test_band_edges(self):
        self.assertEqual([band(v) for v in (0, 30, 35, 65, 70, 100)], [0, 0, 1, 1, 2, 2])

    def test_earlier_personality_wins_a_tie(self):
        # Midway between the first two centres on every slider.
        p = {"sass": 40, "energy": 55, "helpfulness": 75, "chattiness": 65}
        self.assertEqual(personality_of(p)["voice"], "senior")

    def test_personality_of_returns_the_table_row(self):
        row = personality_of({"sass": 90, "energy": 30, "helpfulness": 50, "chattiness": 10})
        self.assertIs(row, personality.PERSONALITIES[3])

    def test_tables(self):
        self.assertEqual([info["key"] for info in personality.SLIDER_INFO],
                         ["sass", "energy", "helpfulness", "chattiness", "codeFocus"])
        self.assertEqual(personality.SPEED_INFO["key"], "speed")
        self.assertEqual([row["voice"] for row in personality.PERSONALITIES], ["senior", "hype", "chaos", "goth"])

    def test_behaviour_keys(self):
        p = {"sass": 0, "energy": 50, "helpfulness": 0, "chattiness": 0, "codeFocus": 0}
        self.assertEqual(list(behaviour(p)),
                         ["idlePauseMs", "walkSpeed", "sleepAfterMs", "chatterEveryMs", "codeChatterChance"])
        self.assertIsNone(behaviour(p)["chatterEveryMs"])
        self.assertEqual(behaviour(p)["walkSpeed"], 70)
        self.assertEqual(behaviour({**p, "speed": 0})["walkSpeed"], 20)


if __name__ == "__main__":
    unittest.main()
