"""The single-file build: repeatable, complete, and holding nothing but the standard library."""
import ast
import importlib.util
import os
import sys
import tempfile
import unittest
import zipfile

DESKTOP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PACKAGE = os.path.join(DESKTOP, "buildaduck")
COMMITTED = os.path.join(DESKTOP, "build-a-duck.pyzw")
NETWORK_MODULES = {"socket", "urllib", "http", "ssl", "ftplib", "smtplib"}

spec = importlib.util.spec_from_file_location("duck_build", os.path.join(DESKTOP, "build.py"))
build_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_module)


def contents(path):
    with zipfile.ZipFile(path) as archive:
        return {name: archive.read(name) for name in archive.namelist()}


class Build(unittest.TestCase):
    def test_two_builds_are_identical(self):
        with tempfile.TemporaryDirectory() as folder:
            first = build_module.build(os.path.join(folder, "a.pyzw"))
            second = build_module.build(os.path.join(folder, "b.pyzw"))
            with open(first, "rb") as a, open(second, "rb") as b:
                self.assertEqual(a.read(), b.read())

    def test_the_archive_holds_the_source_and_a_launcher(self):
        with tempfile.TemporaryDirectory() as folder:
            built = contents(build_module.build(os.path.join(folder, "a.pyzw")))
        self.assertEqual(built["__main__.py"], build_module.LAUNCHER.encode("utf-8"))
        expected = {}
        for root, folders, files in os.walk(PACKAGE):
            folders[:] = [name for name in folders if name != "__pycache__"]
            for name in files:
                if name.endswith(".pyc"):
                    continue
                path = os.path.join(root, name)
                with open(path, "rb") as handle:
                    expected["buildaduck/" + os.path.relpath(path, PACKAGE).replace(os.sep, "/")] = handle.read()
        expected["__main__.py"] = build_module.LAUNCHER.encode("utf-8")
        self.assertEqual(sorted(built), sorted(expected))
        for name, data in expected.items():
            self.assertEqual(built[name], data, name)
        self.assertFalse(any("__pycache__" in name or name.endswith(".pyc") for name in built))
        for needed in ("buildaduck/__main__.py", "buildaduck/data/responses.json", "buildaduck/data/classic.duck.json"):
            self.assertIn(needed, built)

    def test_the_committed_file_matches_the_source(self):
        self.assertTrue(os.path.exists(COMMITTED), "run: py desktop/build.py")
        with tempfile.TemporaryDirectory() as folder:
            fresh = contents(build_module.build(os.path.join(folder, "a.pyzw")))
        committed = contents(COMMITTED)
        self.assertEqual(sorted(committed), sorted(fresh), "run: py desktop/build.py")
        for name, data in fresh.items():
            self.assertEqual(committed[name], data, f"{name} is out of date; run: py desktop/build.py")

    def test_only_the_standard_library_and_no_network(self):
        standard = set(sys.stdlib_module_names)
        for root, folders, files in os.walk(PACKAGE):
            folders[:] = [name for name in folders if name != "__pycache__"]
            for name in files:
                if not name.endswith(".py"):
                    continue
                path = os.path.join(root, name)
                with open(path, encoding="utf-8") as handle:
                    tree = ast.parse(handle.read(), path)
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        modules = [alias.name for alias in node.names]
                    elif isinstance(node, ast.ImportFrom):
                        if node.level:        # a relative import: the package itself
                            continue
                        modules = [node.module]
                    else:
                        continue
                    for module in modules:
                        top = module.split(".")[0]
                        self.assertTrue(top in standard or top == "buildaduck", f"{path} imports {module}")
                        self.assertNotIn(top, NETWORK_MODULES, f"{path} imports {module}")


if __name__ == "__main__":
    unittest.main()
