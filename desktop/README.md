# Build-a-Duck: the desktop duck

A small Python program that puts a duck you made on the Build-a-Duck page onto your Windows
desktop. It walks along the top of the taskbar, squeaks, talks, and checks pasted code.

It needs Windows and Python 3.9 or newer. It uses only Python's standard library, makes no
network connections, and writes three things: its settings
(`%APPDATA%\BuildADuck\config.json`), a squeak sound in your temporary folder, and an error
file there if it crashes.

## Take your duck home

1. Install Python 3.9 or newer from [python.org](https://www.python.org/downloads/), if you do
   not have it.
2. On the Build-a-Duck page, press "Download duck file".
3. Download `build-a-duck.pyzw` from this folder.
4. Double-click `build-a-duck.pyzw`. A duck appears above your taskbar.
5. Right-click the duck, choose "Load another duck...", and pick your duck file. You can also
   drop the duck file onto `build-a-duck.pyzw`.

Click to squeak, double-click to paste code, drag to carry, right-click for the menu. The duck
remembers the last duck file you loaded.

## If double-clicking does nothing

Run it from a terminal in the folder that holds the file:

```
py build-a-duck.pyzw
py build-a-duck.pyzw my-duck.duck.json
```

If the duck closes by itself, the reason is in `%TEMP%\buildaduck-error.txt`.

## What it checks

Java, C/C++, JavaScript and Python. The rules are the page's, ported to Python and tested
against the same sample files. Two differences:

- Python code is also run through Python's own parser, so real syntax errors are found. Code
  written for a different Python version than yours can be reported as an error.
- JavaScript is checked more lightly than on the page, because the page borrows the browser's
  parser and Python has none. The duck says so when it finds nothing.

## Working on it

From the repository root:

| Command | What it does |
|---|---|
| `py -m unittest discover -s desktop/tests -t desktop` | Runs the Python tests |
| `py desktop/build.py` | Rebuilds `build-a-duck.pyzw` from `desktop/buildaduck/` |
| `py desktop/build-a-duck.pyzw --selftest` | Opens the real windows and drives them through a short script |
| `node tools/export_desktop.mjs` | Regenerates the files shared with the page (`data/`, `tests/parity.json`) |

To run from source, use `py -m buildaduck` with `desktop/` as the working directory.

`data/responses.json`, `data/classic.duck.json` and `tests/parity.json` are generated from the
page's JavaScript; `npm test` fails if they are out of date. The built `.pyzw` is committed, and
the Python tests fail if it does not match the source.
