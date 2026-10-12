import json
import os
import unittest

from buildaduck.motion import frame_at, motion_offset

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
    @classmethod
    def setUpClass(cls):
        with open(PARITY, encoding="utf-8") as file:
            cls.motion = json.load(file)["motion"]

    def test_every_offset(self):
        cases = self.motion["offsets"]
        self.assertEqual(len(cases), 4 * 17)
        for case in cases:
            with self.subTest(motion=case["motion"], step=case["step"]):
                self.assertEqual(as_json(motion_offset(case["motion"], case["step"])), as_json(case["result"]))
        print(f"motion offset parity entries compared: {len(cases)}")

    def test_every_frame(self):
        cases = self.motion["frames"]
        self.assertEqual(len(cases), 4 * 17 * 3 * 2)
        for case in cases:
            with self.subTest(animation=case["animation"], step=case["step"], still=case["still"]):
                got = frame_at(case["animation"], case["step"], case["still"])
                self.assertEqual(as_json(got), as_json(case["result"]))
        print(f"motion frame parity entries compared: {len(cases)}")


class MotionTest(unittest.TestCase):
    def test_still_defaults_to_false(self):
        animation = {"seq": [4, 0], "fps": 6, "motion": "hop"}
        self.assertEqual(frame_at(animation, 1), {"frame": 0, "dx": 0, "dy": -2})
        self.assertEqual(frame_at(animation, 1, True), {"frame": 4, "dx": 0, "dy": 0})

    def test_each_call_returns_a_new_dict(self):
        first = motion_offset("none", 0)
        first["dx"] = 9
        self.assertEqual(motion_offset("none", 0), {"dx": 0, "dy": 0})


if __name__ == "__main__":
    unittest.main()
