import json
import os
import tempfile
import unittest
from unittest import mock

from buildaduck.config import DEFAULTS, default_folder, load_config, save_config

PATH = os.path.abspath("my.duck.json")


class ConfigTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.folder = folder.name

    def write(self, text):
        with open(os.path.join(self.folder, "config.json"), "w", encoding="utf-8") as file:
            file.write(text)

    def stored(self, **changes):
        self.write(json.dumps({"v": 1, "duckPath": PATH, "muted": True, "paused": True, "size": "large", **changes}))
        return load_config(self.folder)

    def test_defaults(self):
        self.assertEqual(DEFAULTS, {"v": 1, "duckPath": None, "muted": False, "paused": False, "size": "medium"})

    def test_missing_file(self):
        config = load_config(self.folder)
        self.assertEqual(config, DEFAULTS)
        config["muted"] = True
        self.assertFalse(DEFAULTS["muted"])

    def test_missing_folder(self):
        self.assertEqual(load_config(os.path.join(self.folder, "none", "deeper")), DEFAULTS)

    def test_unreadable_file(self):
        os.mkdir(os.path.join(self.folder, "config.json"))
        self.assertEqual(load_config(self.folder), DEFAULTS)

    def test_malformed_json(self):
        for text in ("", "{", "quack", '{"v": 1, "muted": true', "[" * 100_000, "\xff"):
            with self.subTest(text[:10]):
                self.write(text)
                self.assertEqual(load_config(self.folder), DEFAULTS)
        with open(os.path.join(self.folder, "config.json"), "wb") as file:
            file.write(b'{"v": 1, "size": "\xff"}')
        self.assertEqual(load_config(self.folder), DEFAULTS)

    def test_not_an_object(self):
        for text in ("[]", "null", "1", '"medium"'):
            with self.subTest(text):
                self.write(text)
                self.assertEqual(load_config(self.folder), DEFAULTS)

    def test_all_values_read(self):
        self.assertEqual(self.stored(),
                         {"v": 1, "duckPath": PATH, "muted": True, "paused": True, "size": "large"})

    def test_wrong_types_give_that_value_its_default(self):
        good = {"v": 1, "duckPath": PATH, "muted": True, "paused": True, "size": "large"}
        wrong = {
            "duckPath": [5, True, ["x"], "", "relative.duck.json"],
            "muted": [1, 0, "true", None, []],
            "paused": [1, "no", None, {}],
            "size": ["huge", "Large", 3, None, True, ["large"]],
        }
        for key, values in wrong.items():
            for value in values:
                with self.subTest(key=key, value=value):
                    self.assertEqual(self.stored(**{key: value}), {**good, key: DEFAULTS[key]})

    def test_missing_values_give_their_defaults(self):
        self.write('{"v": 1, "size": "small"}')
        self.assertEqual(load_config(self.folder), {**DEFAULTS, "size": "small"})

    def test_unknown_keys_are_dropped(self):
        self.assertEqual(self.stored(x=40, y=2),
                         {"v": 1, "duckPath": PATH, "muted": True, "paused": True, "size": "large"})

    def test_unknown_v(self):
        for v in (2, 0, "1", True, None, 1.5):
            with self.subTest(v):
                self.assertEqual(self.stored(v=v), DEFAULTS)
        self.write('{"muted": true}')
        self.assertEqual(load_config(self.folder), DEFAULTS)

    def test_round_trip(self):
        config = {"v": 1, "duckPath": PATH, "muted": True, "paused": False, "size": "small"}
        folder = os.path.join(self.folder, "new", "BuildADuck")
        self.assertTrue(save_config(folder, config))
        self.assertEqual(load_config(folder), config)
        with open(os.path.join(folder, "config.json"), encoding="utf-8") as file:
            self.assertEqual(list(json.load(file)), ["v", "duckPath", "muted", "paused", "size"])
        self.assertTrue(save_config(folder, {**config, "duckPath": None, "size": "large"}))
        self.assertEqual(load_config(folder), {**config, "duckPath": None, "size": "large"})

    def test_round_trip_with_a_non_ascii_path(self):
        config = {**DEFAULTS, "duckPath": os.path.abspath("caf\u00e9 \u9d28 \U0001f986.duck.json")}
        self.assertTrue(save_config(self.folder, config))
        self.assertEqual(load_config(self.folder), config)

    def test_unwritable_folder(self):
        blocker = os.path.join(self.folder, "a-file")
        with open(blocker, "w") as file:
            file.write("x")
        # A folder cannot be made inside a file, so nothing can be written here.
        folder = os.path.join(blocker, "BuildADuck")
        self.assertFalse(save_config(folder, dict(DEFAULTS)))
        self.assertEqual(load_config(folder), DEFAULTS)
        self.assertFalse(save_config(blocker, dict(DEFAULTS)))

    def test_default_folder(self):
        with mock.patch.dict(os.environ, {"APPDATA": r"C:\Users\duck\AppData\Roaming"}):
            self.assertEqual(default_folder(), os.path.join(r"C:\Users\duck\AppData\Roaming", "BuildADuck"))
        with mock.patch.dict(os.environ):
            os.environ.pop("APPDATA", None)
            self.assertEqual(os.path.basename(default_folder()), "BuildADuck")


if __name__ == "__main__":
    unittest.main()
