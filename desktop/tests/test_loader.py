import json
import os
import tempfile
import unittest
from unittest import mock

from buildaduck import loader
from buildaduck.loader import MESSAGES, load_duck_file, load_duck_text, parse_json, read_data, read_json


class LoaderTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.folder = folder.name
        self.classic = read_json("classic.duck.json")

    def write(self, data, name="a.duck.json"):
        path = os.path.join(self.folder, name)
        with open(path, "wb") as file:
            file.write(data if isinstance(data, bytes) else data.encode("utf-8"))
        return path

    def altered(self, **changes):
        return json.dumps({**self.classic, **changes})

    def test_a_good_file(self):
        self.assertEqual(load_duck_file(self.write(json.dumps(self.classic))), ("ok", self.classic))

    def test_unreadable_missing_file(self):
        self.assertEqual(load_duck_file(os.path.join(self.folder, "missing.duck.json")), ("error", "unreadable"))

    def test_unreadable_folder_given_as_the_path(self):
        self.assertEqual(load_duck_file(self.folder), ("error", "unreadable"))

    def test_not_json_text(self):
        self.assertEqual(load_duck_file(self.write("quack")), ("error", "not-json"))
        self.assertEqual(load_duck_file(self.write("")), ("error", "not-json"))
        self.assertEqual(load_duck_file(self.write(json.dumps(self.classic) + "}")), ("error", "not-json"))

    def test_not_json_not_utf8(self):
        data = json.dumps(self.classic).encode("utf-8").replace(b"Classic", b"Cl\xe4ssic")
        self.assertEqual(load_duck_file(self.write(data)), ("error", "not-json"))
        self.assertEqual(load_duck_file(self.write(json.dumps(self.classic).encode("utf-16"))), ("error", "not-json"))

    def test_not_json_nan(self):
        text = json.dumps(self.classic).replace('"sass": 50', '"sass": NaN')
        self.assertIn("NaN", text)
        self.assertEqual(load_duck_file(self.write(text)), ("error", "not-json"))

    def test_newer(self):
        self.assertEqual(load_duck_file(self.write(self.altered(v=2))), ("error", "newer"))

    def test_invalid(self):
        self.assertEqual(load_duck_file(self.write(self.altered(roam="sky"))), ("error", "invalid"))
        self.assertEqual(load_duck_file(self.write(self.altered(v=0))), ("error", "invalid"))
        self.assertEqual(load_duck_file(self.write("[]")), ("error", "invalid"))
        self.assertEqual(load_duck_file(self.write("null")), ("error", "invalid"))

    def test_byte_order_mark(self):
        data = b"\xef\xbb\xbf" + json.dumps(self.classic).encode("utf-8")
        self.assertEqual(load_duck_file(self.write(data)), ("ok", self.classic))

    def test_size_limit(self):
        text = json.dumps(self.classic)
        exact = text + " " * (2_000_000 - len(text.encode("utf-8")))
        path = self.write(exact)
        self.assertEqual(os.path.getsize(path), 2_000_000)
        self.assertEqual(load_duck_file(path), ("ok", self.classic))
        path = self.write(exact + " ")
        self.assertEqual(os.path.getsize(path), 2_000_001)
        self.assertEqual(load_duck_file(path), ("error", "not-json"))

    def test_reads_no_more_than_one_byte_past_the_limit(self):
        opened = mock.mock_open(read_data=b"{}")
        with mock.patch.object(loader, "open", opened, create=True):
            self.assertEqual(load_duck_file("anything"), ("error", "invalid"))
        opened.assert_called_once_with("anything", "rb")
        opened().read.assert_called_once_with(2_000_001)

    def test_deep_nesting_is_not_json(self):
        text = "[" * 100_000 + "]" * 100_000
        with self.assertRaises(ValueError):
            parse_json(text)
        self.assertEqual(load_duck_text(text), ("error", "not-json"))
        self.assertEqual(load_duck_file(self.write(text)), ("error", "not-json"))
        self.assertEqual(load_duck_file(self.write('{"a":' * 100_000 + "1" + "}" * 100_000)), ("error", "not-json"))

    def test_messages(self):
        self.assertEqual(MESSAGES, {
            "unreadable": "That file could not be opened.",
            "not-json": "That file is not a duck file.",
            "newer": "That duck was made by a newer Build-a-Duck. Download the desktop duck again from the site.",
            "invalid": "That file is not a duck this version understands.",
        })

    def test_packaged_data(self):
        self.assertTrue(read_data("classic.duck.json").startswith("{"))
        self.assertEqual(load_duck_text(read_data("classic.duck.json")), ("ok", self.classic))
        self.assertEqual(self.classic["name"], "Classic")
        self.assertIsInstance(read_json("responses.json"), dict)


if __name__ == "__main__":
    unittest.main()
