"""Writes desktop/build-a-duck.pyzw: the buildaduck package as one file Python can run.

Run from anywhere:  py desktop/build.py

The archive is written entry by entry with fixed timestamps and a fixed order, so
the same source always gives the same file.
"""
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
PACKAGE = os.path.join(HERE, "buildaduck")
OUTPUT = os.path.join(HERE, "build-a-duck.pyzw")
LAUNCHER = "from buildaduck.__main__ import main\nmain()\n"
FIXED_TIME = (1980, 1, 1, 0, 0, 0)


def entries(package=PACKAGE):
    """Archive name -> bytes for every file the build holds, in name order."""
    found = {"__main__.py": LAUNCHER.encode("utf-8")}
    for folder, subfolders, files in os.walk(package):
        subfolders[:] = sorted(d for d in subfolders if d != "__pycache__")
        for name in files:
            if name.endswith(".pyc"):
                continue
            path = os.path.join(folder, name)
            relative = os.path.relpath(path, package).replace(os.sep, "/")
            with open(path, "rb") as handle:
                found["buildaduck/" + relative] = handle.read()
    return dict(sorted(found.items()))


def build(output=OUTPUT, package=PACKAGE):
    with zipfile.ZipFile(output, "w") as archive:
        for name, data in entries(package).items():
            info = zipfile.ZipInfo(name, FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 0
            info.external_attr = 0o644 << 16
            archive.writestr(info, data)
    return output


if __name__ == "__main__":
    path = build()
    print(f"wrote {path} ({os.path.getsize(path)} bytes)")
    sys.exit(0)
