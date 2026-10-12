import os
import unittest

from buildaduck.startup import choose_duck

CLASSIC = {"name": "Classic"}
MINE = {"name": "Mine"}
OLD = {"name": "Old"}
ARGUMENT = os.path.abspath("mine.duck.json")
REMEMBERED = os.path.abspath(os.path.join("ducks", "old.duck.json"))


def loader(files):
    """A stand-in for load_duck_file: `files` maps a path to what loading it returns."""
    calls = []

    def load(path):
        calls.append(path)
        return files.get(path, ("error", "unreadable"))

    return load, calls


class ChooseDuckTest(unittest.TestCase):
    def test_argument_that_loads(self):
        load, calls = loader({ARGUMENT: ("ok", MINE), REMEMBERED: ("ok", OLD)})
        self.assertEqual(choose_duck([ARGUMENT], {"duckPath": REMEMBERED}, load, CLASSIC), (MINE, "argument", None))
        self.assertEqual(calls, [ARGUMENT])

    def test_argument_is_made_absolute(self):
        load, calls = loader({ARGUMENT: ("ok", MINE)})
        self.assertEqual(choose_duck(["mine.duck.json"], {"duckPath": None}, load, CLASSIC), (MINE, "argument", None))
        self.assertEqual(calls, [ARGUMENT])

    def test_only_the_first_argument_is_used(self):
        load, calls = loader({ARGUMENT: ("ok", MINE)})
        choose_duck([ARGUMENT, REMEMBERED], {"duckPath": None}, load, CLASSIC)
        self.assertEqual(calls, [ARGUMENT])

    def test_argument_that_fails_with_a_remembered_duck(self):
        load, calls = loader({ARGUMENT: ("error", "newer"), REMEMBERED: ("ok", OLD)})
        self.assertEqual(choose_duck([ARGUMENT], {"duckPath": REMEMBERED}, load, CLASSIC), (OLD, "remembered", "newer"))
        self.assertEqual(calls, [ARGUMENT, REMEMBERED])

    def test_argument_that_fails_without_a_remembered_duck(self):
        load, calls = loader({ARGUMENT: ("error", "not-json")})
        self.assertEqual(choose_duck([ARGUMENT], {"duckPath": None}, load, CLASSIC), (CLASSIC, "classic", "not-json"))
        self.assertEqual(calls, [ARGUMENT])

    def test_argument_and_remembered_duck_both_fail(self):
        load, calls = loader({ARGUMENT: ("error", "invalid"), REMEMBERED: ("error", "unreadable")})
        self.assertEqual(choose_duck([ARGUMENT], {"duckPath": REMEMBERED}, load, CLASSIC), (CLASSIC, "classic", "invalid"))
        self.assertEqual(calls, [ARGUMENT, REMEMBERED])

    def test_remembered_duck_that_loads(self):
        load, calls = loader({REMEMBERED: ("ok", OLD)})
        self.assertEqual(choose_duck([], {"duckPath": REMEMBERED}, load, CLASSIC), (OLD, "remembered", None))
        self.assertEqual(calls, [REMEMBERED])

    def test_remembered_duck_that_does_not_load(self):
        load, calls = loader({REMEMBERED: ("error", "unreadable")})
        config = {"duckPath": REMEMBERED}
        # No error key: only a command-line file's failure is reported.
        self.assertEqual(choose_duck([], config, load, CLASSIC), (CLASSIC, "classic", None))
        # The path stays in the settings; the drive may only be unplugged.
        self.assertEqual(config, {"duckPath": REMEMBERED})

    def test_nothing_at_all(self):
        load, calls = loader({})
        duck, source, error = choose_duck([], {"duckPath": None}, load, CLASSIC)
        self.assertIs(duck, CLASSIC)
        self.assertEqual((source, error), ("classic", None))
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
