# Build-a-Duck desktop duck: specification

Revision 3, 2026-10-12. Not yet approved. Revisions 1 and 2 were each audited by a fresh
reviewer; this revision answers the second audit and has not itself been audited. Section 3
separates what the user has accepted from what still needs their word.

## 1. Purpose

A small Python program that puts a duck made on the Build-a-Duck page onto the Windows desktop.
It reads the `.duck.json` file the page exports and shows that duck in a transparent window that
stays on top of other windows: it walks along the top of the taskbar, can be dragged, squeaks,
talks in a pixel speech bubble, and checks pasted code. The page gains instructions for getting
and running it.

The web page is specified in `docs/SPEC.md`, called "the web spec" here.

## 2. Scope

In scope:

- a Python package, `desktop/buildaduck/`, and a single-file build of it,
  `desktop/build-a-duck.pyzw`
- loading and validating a `.duck.json` file
- the duck window: drawing, walking, dragging, carried and landing poses, sleeping
- squeak sound, speech bubble, personality chatter
- the code check for Java, C/C++, JavaScript and Python
- a right-click menu
- remembering a few settings between runs
- a "Take your duck home" block of instructions in the page's Export panel
- tests, including parity tests against the JavaScript implementation

Out of scope:

- macOS and Linux
- reading share links (`#d=` payloads); only `.duck.json` files are read
- editing the duck or its personality; that stays on the page
- the "along a path I draw" walking mode (section 7.3)
- more than one monitor: the duck lives on the primary monitor
- keyboard control of the duck and screen-reader support for the duck window (the paste box
  and file dialog are ordinary windows and work with the keyboard)
- an installer, a signed executable, auto-start with Windows, auto-update
- the browser's JavaScript parser (web spec rule R6); see section 9.2

## 3. Decisions

### 3.1 Accepted by the user (2026-10-10)

1. Windows only.
2. No dependencies beyond Python's standard library. No `pip install`.
3. "How you run it: `python duck.py my-duck.duck.json`, or drag the JSON onto the script. With
   no file, it starts as the Classic duck." (Proposals A and B below change the file name and
   the last sentence.)
4. The duck walks along the top of the taskbar; can be dragged, with the carried pose and the
   splash landing; squeaks and speaks in a pixel speech bubble on click; chatters by
   personality; double-click opens a paste box for the code check; right-click gives a menu
   with mute, load another duck, and quit.
5. Walking modes: along the bottom, all over the screen, sit in the top right. No drawn path.
6. It lives in `desktop/` in the same repository, linked from the page's Export panel ("Take
   your duck home").
7. The Python checker is tested with the same corpus as the web checker.
8. Order of work: audit the web page, build this, then deploy both together.
9. The page itself carries the instructions (the user's request).

### 3.2 Needs the user's approval

These are not in what the user accepted. Each is a recommendation; the build follows this
section as written only once the user approves the spec.

| # | Proposal | Why |
|---|---|---|
| A | The program is one file, `build-a-duck.pyzw` (a zip of the package that Python runs directly), not `duck.py`. | The code is several modules plus data; one file is simpler to download. `.pyzw` runs without a console window. |
| B | The last duck loaded is remembered, so a later double-click shows that duck, not Classic. Classic appears only when nothing has been loaded yet or the remembered file is gone. | Otherwise every start needs the file again. This changes accepted item 3. |
| C | A settings file, `%APPDATA%\BuildADuck\config.json`, holds the last duck's path, mute, pause and size. | Needed for B and so mute survives a restart. |
| D | Three more menu items: "Paste code...", "Pause motion", and "Size" (Small, Medium, Large). | Another way into the paste box; a way to stop movement; screens differ. |
| E | The duck naps. It falls asleep after `sleepAfterMs` (20 to 60 seconds, by Energy) without being clicked, dragged or asked anything; it wakes by itself after 60 seconds, or at once when touched, and then walks and chatters again until the next nap. | The page's rule (asleep until there is activity on the page) has no good desktop equivalent: tied to the whole computer, the duck would only sleep when nobody is there; tied to the duck alone, it would fall asleep within a minute and never walk or chatter again until clicked. |
| F | JavaScript is checked with rules R1, R2 and R4 only (brackets, strings and comments, `=` in a condition). No semicolon rule. | The user was told "the same rules as Java and C", but the semicolon rule misfires on JavaScript written without semicolons, which is common. Measured cost: without the browser's parser, 11 of the 16 broken JavaScript test files are caught, against 16 of 16 on the page. To stay honest, when the desktop duck finds nothing in JavaScript it adds a fixed sentence after its usual "looks clean" line: "I can only check JavaScript lightly here." (Its "not sure" lines are not used for this: they are worded for a suspected missing semicolon.) |
| G | For Python, when Python's parser reports an error the heuristics cannot name, the duck says its usual "does not parse" line followed by "Python points at line N." | The existing lines for that case never mention a line, and Python knows it. |
| H | A file limit of 2,000,000 bytes, and four plain messages for files that do not load (section 6). | The page has no limit because it reads in the browser; a desktop program should not read an arbitrary large file into memory. |
| I | A `path` duck walks along the bottom. A `sit` duck that is dragged stays where it is put until the program restarts. | The first matches the page when no path is drawn. The second matches the page. |
| J | The built `.pyzw` file is committed to the repository, with `desktop/build.py` and `desktop/README.md`. | GitHub Pages serves only committed files. |
| K | The instructions sit in a collapsed block titled "Take your duck home (Windows)", with a "See the source" link and the sentence "It makes no network connections." | Most visitors will not want it; the claim is true and reassures the ones who do. |
| L | Supported Python: 3.9 or newer, with a message if older. Tested only on the build machine's 3.12. | A floor has to be stated. |
| M | `js/syntax/index.js` and `js/syntax/javascript.js` gain an option to skip the browser parser. The page never uses it. | The Python port is compared with the JavaScript rules without the parser; this is how those values are produced. |
| N | One new Node tool and one new Node test (section 4), and a `--selftest` argument. | They keep the two implementations and the built file from drifting. |
| O | A squeak WAV is written to the temporary folder at start and left there. | The standard library can play a sound only from a file without blocking. |
| P | For Python, when Python's parser accepts the code, bracket, string and `=` hunches are dropped but an inconsistent-indentation hunch is kept. A pasted fragment that is indented as a whole is un-indented before parsing. | The parser is the better judge of the first three; mixed tabs and spaces can be legal and still a mistake. People paste the inside of a function. |
| Q | Known limits for Python: code for a different Python version than the one running the duck (Python 2 `print`, or newer syntax) and a fragment that starts mid-statement (such as a lone `else:`) are reported as not parsing. | The parser can only judge whole statements in its own version. |

Smaller points, also not in what the user accepted. Each is in the section named:

- The duck is shown on the primary monitor only; share links are not read; the duck window
  has no keyboard or screen-reader support (section 2).
- Messages "The desktop duck runs on Windows only." and "The desktop duck needs Python 3.9 or
  newer."; an error box and `%TEMP%\buildaduck-error.txt` for a crash (section 5).
- The program asks Windows for sharp pixels on scaled displays, and every size follows the
  display's scaling (sections 5 and 7.1).
- A leading byte-order mark in a duck file is accepted (section 6).
- The taskbar's position is re-read every 2 seconds; with a side, top or hidden taskbar the
  duck stands at the bottom of the screen (section 7.2).
- In "all over the screen" mode the duck may stop over anything; the page avoids controls
  (section 7.4).
- Walking and falling speed grow with the duck's size (section 7.4).
- Opening the menu counts as touching the duck for naps (section 7.4).
- The bubble wraps at 320 px in Consolas 11 pt; the page uses 360 px and its own font
  (section 8).
- The paste box says "Syntax check only. Your code is not sent anywhere." without the page's
  "Runs in your browser."; asking for the paste box while it is open brings it forward
  (section 9.1).
- The load dialog also lists plain `*.json` files (section 10).
- Two copies may run at once; the duck's position is not remembered (section 11).
- `.gitattributes` marks `*.pyzw` as binary (section 4).
- Two more sentences on the page, beside those in K: "Click to squeak, double-click to paste
  code, drag to carry, right-click for the menu." and "It is a Python script, so Windows may
  ask before running it."; and the terminal command (section 12).
- A scripted browser check of the page's new block, kept in `tests/` (section 13).

## 4. Files

```
desktop/
  buildaduck/
    __init__.py
    __main__.py        main(): platform check, error handling, starts the app
    startup.py         choose_duck(args, config, load): which duck to show first (pure)
    duck_format.py     validate_duck and constants (port of validateDuck)
    loader.py          load_duck_file(path) -> ("ok", duck) or ("error", message_key)
    personality.py     band, trait_words, personality_of, label, is_buddy, sass_level, behaviour
    picker.py          create_picker, fill, compose_hunches, chatter_key, buddy_key, voice_of,
                       extra_sentence
    motion.py          motion_offset, frame_at (ports from js/sprite-render.js)
    brain.py           DuckBrain: the state machine and geometry, with no tkinter (section 7.4)
    syntax/
      __init__.py      guess_language, check_code, MAX_PASTE, LANGUAGE_ORDER
      common.py        scan, check_brackets, check_condition_assign, check_semicolons, ...
      java.py  c.py  javascript.py  python.py
    config.py          load_config(folder), save_config(folder, config)
    sound.py           squeak_samples() (pure), write_squeak(path), play(path)
    win.py             ctypes helpers: work area, DPI
    app.py             the tkinter program: windows, drawing, bubble, paste box, menu
    data/
      responses.json       generated from js/responses.js
      classic.duck.json    generated from data/presets.js (the Classic preset)
  tests/
    __init__.py            empty; unittest discovery needs it
    test_startup.py  test_format.py  test_loader.py  test_personality.py  test_picker.py  test_motion.py
    test_brain.py  test_syntax_parity.py  test_syntax_corpus.py  test_python_parse.py
    test_config.py  test_sound.py  test_build.py
    parity.json            generated expected values from the JavaScript implementation
  build.py             writes desktop/build-a-duck.pyzw
  build-a-duck.pyzw    the built file, committed
  README.md
tools/export_desktop.mjs       writes the three generated files above
tests/desktop-export.test.js   fails when a generated file is out of date
tests/desktop-page.check.mjs   the scripted browser check of the instructions block (run by hand)
```

Paths written by `tools/export_desktop.mjs`, from the repository root:
`desktop/buildaduck/data/responses.json`, `desktop/buildaduck/data/classic.duck.json`,
`desktop/tests/parity.json`.

Module boundaries. Pure (no tkinter, no ctypes, no file access): `duck_format`, `personality`,
`picker`, `motion`, `brain`, `syntax`, `startup`, and `squeak_samples`. File access only: `loader`,
`config`, `write_squeak`. Windows-only: `win`, `sound.play`, `app`. Packaged data is read with
`importlib.resources.files("buildaduck")`, which works from the `.pyzw` file. All pure and
file-access modules are unit-tested; `app.py` is covered by the self-test (section 13).

Paradigm: plain functions and dictionaries in the pure modules, mirroring the JavaScript; two
classes, `DuckBrain` in `brain.py` and `DuckApp` in `app.py`. Python naming (`snake_case`);
the duck dictionary keeps the file's own key names (`codeFocus`).

Changes to existing web code:

- `check(text, { useParser = true } = {})` in `js/syntax/javascript.js`. With
  `useParser: false` it behaves exactly as when R6 is unavailable.
- `checkCode(text, language, options)` in `js/syntax/index.js` passes `options` to the
  language's `check`. The other three checkers ignore it. The page calls `checkCode` with two
  arguments, as now.
- `index.html`, `css/app.css`: the instructions block (section 12).
- `.gitattributes`: `*.pyzw binary`.

Python interfaces:

- `syntax.check_code(text, language, use_parser=True)` returns
  `{"status", "findings", "unsure"}`; each finding is `{"rule", "kind", "line"}`.
- `syntax.python.check(text, use_parser=True)`: with `use_parser=False` it is the port of
  `js/syntax/python.js` alone.
- `syntax.javascript.check(text, use_parser=True)`: the argument is accepted and ignored;
  see section 9.2.
- `picker.extra_sentence(result, language)` returns the fixed sentence to add after the
  duck's lines, or an empty string (section 9.2).
- `startup.choose_duck(args, config, load)` returns `(duck, source, error_key)`: `source` is
  `"argument"`, `"remembered"` or `"classic"`; `error_key` is section 6's key when a
  command-line file was given and did not load, else None. `load` is `load_duck_file`.

`docs/SPEC.md` is updated for the web changes: its file list, its section 13 and a new entry
in its section 21.

## 5. Starting up

`main()` in `__main__.py`, in order. A double-clicked `.pyzw` has no console, so the first
uncaught exception, whether raised at start-up or inside a tkinter callback (caught through
`Tk.report_callback_exception`), is written in full to `%TEMP%\buildaduck-error.txt`, shown
once in a message box titled "Build-a-Duck" with its last line, and then the program exits
with code 1. Nothing is written to standard error when it is absent.

1. Not Windows: the message "The desktop duck runs on Windows only." (message box if tkinter
   can open one, otherwise standard error if there is one); exit code 1.
2. Python older than 3.9: the same, with "The desktop duck needs Python 3.9 or newer."
3. Make the process DPI-aware (`SetProcessDpiAwareness(1)`, ignoring failure) so art pixels
   are sharp. Read the DPI with `GetDpiForSystem()`, or 96 if that call is missing.
4. Read the settings (section 11).
5. Choose the duck: the first command-line argument if given (made absolute); else the
   settings' `duckPath` if that file loads; else the packaged Classic duck.
6. If a command-line file was given and does not load, show the reason (section 6) in a
   message box and carry on with the next choice in step 5.

Steps 5 and 6 are `startup.choose_duck`. A remembered path that no longer loads is left in
the settings (the file may be on a drive that is not plugged in) and Classic is shown.

A file dropped onto `build-a-duck.pyzw` in Explorer arrives as the first argument (Python's
installer registers a drop handler for `.pyzw`). This is a requirement; it is checked by hand
on the build machine and its result is reported. The menu's "Load another duck..." does the
same job without it.

`--selftest` as the only argument runs section 13's self-test and exits.

## 6. The duck file

`duck_format.validate_duck(value)` is a port of `validateDuck` in `js/duck-format.js` as it
stands when the build starts: the same rules in the same order, the same reason codes, the
same defaults (`carried` and `landing` default to a copy of `idle`; `speed` defaults to
`energy`), and the same normalised result. It returns `(True, duck)` or `(False, reason)`.

Points where Python and JavaScript differ and the port must follow JavaScript:

- **Integers.** A JSON number counts as an integer when it is a whole number, so `2.0`
  passes where `2` does and is stored as `2`. `True` and `False` are never numbers.
- **Not-a-number values.** `NaN`, `Infinity` and `-Infinity` in the file make it "not JSON"
  (the loader passes `parse_constant` to reject them).
- **Patterns.** Colour and base64 patterns are matched with `re.fullmatch`, so a trailing
  newline does not pass.
- **Base64.** A frame is decoded as `atob` does. With no `=` in it, any length that is not
  one more than a multiple of 4 is accepted. With `=` in it, the whole length must be a
  multiple of 4. (So for a 1024-byte frame: 1,366 characters unpadded and 1,368 with `==`
  pass; 1,367 with a single `=` does not.) Python's `b64decode` does neither by itself.
- **Lists of anything.** A `languages` entry that is itself a list or object gives the reason
  `languages`, not an exception from building a set.
- **Name.** Trimmed of the same characters as JavaScript's `trim()` (whitespace and line
  terminators as ECMAScript defines them), and its length is counted in UTF-16 code units.

`loader.load_duck_file(path)` reads at most 2,000,001 bytes, decodes as UTF-8 (a leading
byte-order mark is accepted), parses as JSON and validates. JSON nested too deeply for Python
to parse (`RecursionError`) counts as not JSON. It returns `("ok", duck)` or
`("error", key)`:

| Key | Cause | Message shown |
|---|---|---|
| `unreadable` | the file cannot be opened or read | "That file could not be opened." |
| `not-json` | more than 2,000,000 bytes, not UTF-8, or not JSON | "That file is not a duck file." |
| `newer` | reason `version-newer` | "That duck was made by a newer Build-a-Duck. Download the desktop duck again from the site." |
| `invalid` | any other reason | "That file is not a duck this version understands." |

A failed load never changes the duck on screen.

## 7. The duck window

### 7.1 Window and drawing

- One borderless tkinter window, always on top, with no taskbar button
  (`overrideredirect(True)`, `-topmost`, `-toolwindow`). Its background is a key colour made
  transparent with `-transparentcolor`, so only the duck's own pixels show and take clicks.
  The key colour is the first of `#ff00fe`, `#00ff01`, `#0100ff` that is not in the duck's
  palette.
- The window is `(32 + 2 * 2) * scale` pixels square: the page's 2-pixel motion margin.
- `ui = dpi / 96`. `medium = max(2, floor(3 * ui + 0.5))`. Sizes: Small is `medium - 1`,
  Medium is `medium`, Large is `medium + 2`. Every other length in this document given in
  px (bubble width, border, gaps, the corner inset, the drag threshold) is multiplied by `ui`
  and rounded half up (`floor(x + 0.5)`).
- Each frame is drawn from the duck file's palette indices as a `PhotoImage` at the current
  scale, with index 0 left transparent. Images for both facing directions are built once per
  duck and scale. The duck faces right as drawn and is mirrored when walking left.
- Animation frame and motion offset come from `frame_at` and `motion_offset`.
- The program ticks about 30 times a second using `after`.

### 7.2 Where the ground is

The work area of the primary monitor (the screen minus the taskbar, wherever the taskbar is
docked) comes from `SystemParametersInfoW(SPI_GETWORKAREA)` and is re-read every 2 seconds.
`groundY` is the bottom of the work area minus the window's height plus the 2-art-pixel
margin (`2 * scale`), so the duck's lowest pixels touch the edge; with the taskbar at the
bottom that is on top of the taskbar, otherwise the bottom of the screen. With an auto-hidden
taskbar the duck stands at the bottom of the screen. `x` runs from the work area's left edge
to its right edge minus the window's width. The duck starts on the ground, `40 * scale / 3`
px from the left edge.

### 7.3 Walking modes

| `roam` | Behaviour |
|---|---|
| `strip` | walks left and right along the ground |
| `page` | walks to random points anywhere in the work area |
| `sit` | walks to 16 px inside the top right corner of the work area and stays; if dragged, stays where it is left until the program restarts |
| `path` | the same as `strip`; the drawn path is kept by the browser and is not in the file |

### 7.4 The brain

`brain.DuckBrain(duck, pool, bounds, scale, clock, rng)` holds the state machine, the
position and the picker, and has no tkinter in it. `pool` is the response pool; `bounds` is
`(left, top, right, bottom)` of the work area; `clock()` returns milliseconds; `rng()`
returns a number in [0, 1) and feeds both the picker and the walk targets, in call order. The
tests pass their own clock and numbers.

Methods `app.py` calls:

| Method | When |
|---|---|
| `tick()` | every frame |
| `on_press(x, y)`, `on_move(x, y)`, `on_release(x, y)` | left button, in screen pixels; the brain decides click, double-click or drag |
| `on_menu()` | the menu opened |
| `on_bubble_next()`, `on_bubble_close()`, `on_bubble_action()` | the bubble's buttons |
| `on_paste_opened()`, `on_paste_closed(text, language)` | the paste box; `text` is None when cancelled |
| `set_duck(duck)`, `set_scale(scale)`, `set_bounds(bounds)`, `set_paused(flag)`, `set_muted(flag)` | changes from the menu, a loaded file, or the taskbar moving |

Fields it reads after each call: `state`, `animation`, `step`, `x`, `y`, `facing_left`,
`bubble` (None, or `{text, index, count, action}`), `wants_paste_box` (set by the bubble's
action or the menu, cleared by `on_paste_opened`), and `squeak` (true for one tick when a
sound should play).

The behaviour reference is `js/stage.js` as it stands when the build starts, including these
values that are only in the code: squeaking lasts 300 ms or one pass of the sequence,
whichever is longer, and then becomes talking if the bubble is open; one tick moves the duck
by at most 100 ms of travel; thinking lasts 800 ms; if the paste box is opened again while
the duck is thinking, the answer waits until it closes.

When the size or the duck changes: the position is kept and brought inside the bounds, a
dragged `sit` spot is kept, and an open bubble closes. While paused the duck goes to the
ground, or to its sit spot in `sit` mode, as on the page.

States and animations are those of web spec section 10 as amended by its section 21: idle,
walking, sleeping, squeaking, thinking, talking, falling, landing, and being dragged.
Numbers come from `behaviour(personality)`: `idlePauseMs`, `walkSpeed`, `sleepAfterMs`,
`chatterEveryMs`, `codeChatterChance`. `walkSpeed` and the fall speed (900 px per second) are
multiplied by `scale / 3`, so the duck covers the same number of its own lengths per second at
any size.

Differences from the page:

- **Sleep**: the duck sleeps when `sleepAfterMs` has passed since it was last clicked,
  dragged, asked about code, had its menu opened, or woke from a nap. It wakes after 60,000
  ms asleep, or at once on any of those.
- **No "rests on a control" check** in `page` mode.
- **Pause motion** stops walking, looping and chatter, as on the page. There is no
  reduced-motion system setting to follow.

### 7.5 Mouse

As on the page:

- **Left click** (on release, with less than 6 px of movement): squeak (unless muted), the
  squeak animation, and one chatter line.
- **Second click of a double-click**: no second squeak. In buddy mode a buddy line; otherwise
  the line "You look like you're stuck, paste your code for a check" with a "Paste code"
  button. Third and later clicks of a run do nothing.
- **Left drag** (6 px or more with the button held): the duck follows the pointer and shows
  `carried`. A drag that starts while the duck is walking, sleeping, falling or landing puts
  it in the idle state first. On release, if the state is idle: in `strip` or `path` mode it falls to the
  ground and then shows `landing` for 700 ms or one pass of the sequence, whichever is longer;
  in `page` and `sit` mode it shows `landing` where it is. If the state is anything else at
  release (squeaking, talking, thinking) there is no landing and, in `strip` or `path` mode,
  the duck is put on the ground. A drag is not also a click. The window stays inside the work
  area.
- **Right click**: the menu (section 10).

## 8. Speech bubble and sound

- The bubble is a second borderless, always-on-top window with a transparent key colour. On
  it is drawn the page's box: white fill, a 4 px black border with stepped corners (the four
  corner squares left empty), and the page's tail on the bottom edge, or on the top edge when
  the bubble is below the duck: a black bar 12 px wide and 4 px tall with a 4 px square
  beyond it. The tail is centred on the duck and kept 16 px from either end of the edge. Text is black Consolas 11 pt, wrapped
  at 320 px.
- It sits centred over the duck with a 10 px gap, below it when there is no room above, and
  is kept inside the work area. It follows the duck.
- One page at a time. With more than one page it shows "N of M" and a Next button; Close is
  always present; the prompt line has its "Paste code" button.
- Auto-close, as on the page: when the page showing has no action button and no further
  page, it closes after `4000 + 60 * characters` ms, unless Pause motion is on.
- Lines are chosen as on the page: `compose_hunches`, `chatter_key`, `buddy_key`, `fill` and
  the shuffle-bag picker are ports with identical outputs given the same random numbers. The
  pool is `data/responses.json`.
- Unprompted chatter, as on the page: on entering idle and each time an idle pause ends
  without a walk, if `chatterEveryMs` is not null, that long has passed since the bubble last
  closed (or since the program started), motion is not paused, and neither the bubble
  nor the paste box is open.
- **Squeak**: the page's sound, rendered to a file. A sine whose frequency rises linearly
  from 900 Hz to 1500 Hz over the first 60 ms and falls linearly to 700 Hz at 180 ms; gain
  rising exponentially from 0.0001 to 0.25 over the first 20 ms and falling exponentially to
  0.0001 at 180 ms; samples are the gain times the sine times 32,767; 22,050 Hz, 16-bit mono. Written at start to
  `%TEMP%\buildaduck-squeak.wav` (overwritten each run, not deleted) and played with
  `winsound.PlaySound(path, SND_FILENAME | SND_ASYNC | SND_NODEFAULT)`. If it cannot be
  written or played the duck is silent and nothing is reported.

## 9. Code check

### 9.1 The paste box

An ordinary window titled "Paste code for <name>": a language drop-down, a text box, the
line "Syntax check only. Your code is not sent anywhere.", and the buttons "Ask the duck" and
"Cancel". The drop-down offers the duck's chosen languages in the order Java, JavaScript,
Python, C/C++, or all four if none were chosen. Until the visitor changes the drop-down it
follows `guess_language` on each change to the text. On "Ask the duck" the box closes, the
duck shows `thinking` for 800 ms and then speaks the result. There is at most one paste box;
asking for it again brings the open one forward. Not available in buddy mode (Code focus 0).

`check_code` returns status `empty` for blank text, `too-long` above 20,000 UTF-16 code units
(the page's count), otherwise `ok`.

### 9.2 Rules

`syntax/` is a port of `js/syntax/`.

**Java and C/C++**: the same findings (rule, kind, line) and the same `unsure` flag as the
JavaScript code for the same text.

**JavaScript**: exactly what the page gives with `useParser: false` (R1, R2 and R4 findings,
and its `unsure` value). `use_parser` has no effect. When the status is `ok` and there are no
findings, `extra_sentence` returns "I can only check JavaScript lightly here." and `app.py`
puts it after the duck's `clean` line, separated by a space.

**Python**: with `use_parser=False`, the same findings as `js/syntax/python.js`. With the
default, rule **P6** is added. A leading U+FEFF is removed. If the text contains a null
character, P6 is unavailable. Otherwise the text is parsed with `ast.parse(text)` with
warnings suppressed; if that raises `IndentationError` whose message starts "unexpected
indent", it is parsed once more after `textwrap.dedent`, and that second result stands.
(`ast.parse` accepts a pasted fragment such as a bare `return` or `await`, which `compile`
would reject.)

- It parses: R1, R2 and R4 findings are discarded; R5 (inconsistent indentation) findings are
  kept, because Python accepts some mixes of tabs and spaces that are still mistakes.
- `SyntaxError` (including `IndentationError` and `TabError`) and the heuristics found
  something: the heuristic findings are used.
- `SyntaxError` and the heuristics found nothing: one finding `{rule: "P6", kind: "parse",
  line: N}` where N is the error's `lineno` or null.
- `ValueError`, `RecursionError`, `MemoryError` or `OverflowError`: P6 is unavailable.
- P6 unavailable: the heuristic findings are used as they are.

When the findings are a single P6 finding with a line, `extra_sentence` returns "Python
points at line N." and `app.py` puts it after the duck's
`hunch.<voice>.parse.<sass>.vague` line, separated by a space. `compose_hunches` itself is
unchanged.

Known limits (proposal Q): code for a different Python version than the one running the
duck, and a fragment that starts mid-statement, are reported as not parsing.

**Text handling the port must match.** Regular expressions use `re.ASCII` where the
JavaScript uses `\w`, `\b` or `\d`, and an explicit ECMAScript whitespace class where it uses
`\s`. JavaScript's multiline `^`, `$` and `.` treat `\r`, U+2028 and U+2029 as line ends as well
as `\n`; the port writes those out explicitly. Where the JavaScript calls `trim()`,
`trimStart()` or `trimEnd()`, including `checkCode`'s blank test, the port strips exactly
the ECMAScript whitespace and line-terminator characters, not Python's `strip()` set. Line numbers count `\n` only, as on the page.
String indices and lengths are in UTF-16 code units; the port converts the text to a list of
code units once, or proves a rule cannot be affected. The parity file includes cases written
to tell a correct port from a naive one (section 13).

## 10. Menu

Right-click on the duck:

- **Paste code...** (absent in buddy mode)
- **Mute** (a check mark when on)
- **Pause motion** (a check mark when on)
- **Size**: Small, Medium, Large
- **Load another duck...**: a file dialog filtered to `*.duck.json` and `*.json`. A file that
  loads replaces the duck at once and becomes `duckPath`. A file that does not load shows
  section 6's message.
- **Quit**

## 11. Settings

`%APPDATA%\BuildADuck\config.json`:

```json
{ "v": 1, "duckPath": null, "muted": false, "paused": false, "size": "medium" }
```

Those are the defaults. `duckPath` is null or an absolute path; `size` is `small`, `medium`
or `large`. The file is written when one of these changes and when a command-line duck loads.
A missing, unreadable or malformed file, an unknown `v`, or a wrong-typed value gives the
default for that value; nothing is reported. If the folder cannot be created or written the
program runs without remembering. The duck's position is not remembered. Two copies may run
at once; the last one to change a setting wins.

`config.load_config(folder)` and `save_config(folder, config)` take the folder as an
argument so tests and the self-test can use a temporary one.

## 12. The single-file build and the page's instructions

**Build.** `desktop/build.py` writes `desktop/build-a-duck.pyzw` itself with `zipfile`, so
that the same source always gives the same bytes:

- entries: `__main__.py` at the root containing
  `from buildaduck.__main__ import main` and `main()`; then every file under
  `desktop/buildaduck/` at `buildaduck/<relative path>`, except `__pycache__` folders and
  `*.pyc` files
- entries sorted by name, each with the timestamp 1980-01-01 00:00:00, permissions 0644,
  deflate compression
- no interpreter line

Run from source: `py -m buildaduck` with `desktop/` as the working directory. Run the build:
`py desktop/build-a-duck.pyzw [file]`. On a machine with Python installed from python.org,
double-clicking a `.pyzw` runs it without a console window.

**On the page.** The Export panel gains, after its existing controls, a `<details>` element,
closed by default, with the summary "Take your duck home (Windows)" and this content:

1. Install Python 3.9 or newer from python.org, if you do not have it.
2. Press "Download duck file" above.
3. Download the desktop duck: a link to `desktop/build-a-duck.pyzw` with the `download`
   attribute.
4. Double-click `build-a-duck.pyzw`. A duck appears above your taskbar.
5. Right-click the duck, choose "Load another duck...", and pick your duck file. You can also
   drop the duck file onto `build-a-duck.pyzw`, or run
   `py build-a-duck.pyzw my-duck.duck.json` in a terminal.

Then: "Click to squeak, double-click to paste code, drag to carry, right-click for the menu.
It is a Python script, so Windows may ask before running it. It makes no network
connections." and a link "See the source" to
`https://github.com/Bland16/rubber-duck/tree/main/desktop`.

It uses the page's existing text, list, link and focus styles. New CSS: `.take-home` with a
top margin of `var(--space-3)`; its `summary` with `cursor: pointer`, bold text and a minimum
height of 32 px; the command in a `<code>` element. It is not shown in view-only mode, because the Export panel is not.

`desktop/README.md` repeats the steps and adds: running from a terminal, running the tests,
rebuilding, and what to try if double-clicking does nothing (run
`py build-a-duck.pyzw` in a terminal).

The program makes no network connections. It writes only its settings file, the squeak WAV
and, after a crash, the error file.

## 13. Test plan

Commands, from the repository root:

- Python: `py -m unittest discover -s desktop/tests -t desktop`
- Node: `npm test`
- Self-test: `py -m buildaduck --selftest` in `desktop/`, and
  `py desktop/build-a-duck.pyzw --selftest`

Tests find the corpus at `../../tests/corpus` from `desktop/tests/`.

**Generated expectations.** `tools/export_desktop.mjs` runs the JavaScript implementation and
writes `desktop/tests/parity.json`:

- **format**: the four presets and at least 40 altered ducks covering every reason code,
  every defaulted field and every limit: the input and `validateDuck`'s exact result.
- **personality**: every combination of 0, 30, 35, 65, 70, 100 over sass, energy,
  helpfulness and chattiness with codeFocus 50 and no speed (1,296 cases), plus 300 seeded
  random personalities that vary codeFocus (including 0 and 100) and speed (including
  absent): `label`, `traitWords`, `isBuddy`, `sassLevel`, `behaviour`.
- **motion**: `frameAt` and `motionOffset` for every motion, steps 0 to 16, sequence lengths
  1, 2 and 8, motion on and off.
- **syntax**: for every corpus file, named by path and not copied, checked as each of the
  four languages with `useParser: false`: findings and `unsure`. The same for these variants
  of every corpus file, made by rule and named in the entry: line ends changed to CRLF; and
  a comment line holding non-ASCII text (an accented word, a CJK word and an emoji) inserted
  as the first line. And these hand-written texts, each checked as all four languages, which
  a port using Python's own `\b`, `\s`, `^`, `$` or `strip()` gets wrong:
  `éif (x = 1) {}`; `if\x1f(x = 1) {}`; `if\ufeff(x = 1) {}`; a text that is only `\x1c`;
  a text that is only `\ufeff`; `if (x = 1) {}` after a lone `\r`; the same after U+2028;
  a Python `def f():` line ended by a lone `\r`; an emoji before an unclosed bracket on the
  same line. `guessLanguage` for every corpus file and its CRLF variant with all four
  languages offered and with each pair offered. `checkCode` for empty text, blank text, and
  text of 20,000 and 20,001 code units, the last two also built from emoji.
- **speech**: 200 seeded cases (a result, a preset duck with varied sliders, and a recorded
  sequence of random numbers), which between them include the statuses `empty` and
  `too-long`, an `ok` result with no findings both sure and unsure, every finding kind, and
  more findings than the duck's helpfulness shows (the "(+N more)" ending): the lines from `composeHunches`, and the
  `chatterKey`, `buddyKey` and `fill` results. The Python picker is driven by the recorded
  numbers and must make the same choices.

`tests/desktop-export.test.js` regenerates the three generated files in memory and fails if
any differs from the committed copy.

**Python tests.**

- `test_format`, `test_personality`, `test_motion`, `test_picker`, `test_syntax_parity`:
  every case in `parity.json` gives the same result in Python.
- `test_format` also feeds raw text through the loader's JSON step for what JSON cannot
  carry in `parity.json`: `2.0` for an integer field; `true` for `v`; `NaN`; a colour with a
  trailing newline; a frame of 1,366 characters unpadded (passes), of 1,368 with `==`
  (passes), of 1,367 with one `=` (fails) and of 1,365 (fails); `languages` holding a list; a
  name of 24 emoji; a name padded with a non-breaking space.
- `test_loader`: each row of section 6's table, the byte-order mark, a file of exactly
  2,000,000 and of 2,000,001 bytes, a folder given as the path, JSON nested 100,000 deep.
- `test_startup`: an argument that loads; one that does not, with and without a remembered
  duck; a remembered duck that loads and one that does not; nothing at all.
- `test_syntax_corpus`: the web corpus with its `.expect.json` sidecars through
  `check_code` with the parser on, judged exactly as `tests/corpus.test.js` judges (kind,
  and line within 1). Java and C/C++: the same pass and catch lists as the page. JavaScript:
  the lists recorded in `parity.json` for `useParser: false`; a valid file must give
  `unsure` true and no findings. Python: every valid file has no finding and every broken
  file is caught as its sidecar says.
- `test_python_parse`: each P6 branch; a file Python accepts that R5 flags keeps its R5
  finding; the fragments `return x + 1`, an indented function body, an indented body whose
  first line is a comment, `await f()`, `break` and `yield 1` give no finding; a body whose
  first line is indented deeper than a later one gives a finding; a null character makes P6
  unavailable; a leading U+FEFF is ignored; 20,000 characters.
- `test_picker` also covers `extra_sentence`: a single P6 finding with a line, one without a
  line, P6 beside other findings, clean JavaScript, JavaScript with findings, clean Java.
- `test_brain`, with a fake clock and fixed random numbers: the idle pause, walk speed,
  sleep time, the 60-second nap and what follows it, and chatter interval for sliders at 0, 50
  and 100; speed scaling with size; each
  walking mode's targets stay inside the bounds; `sit` reaches the corner and stops; a drag
  in each mode and from each state gives section 7.5's result; fall speed and landing length;
  click, double-click and triple-click; the bubble's auto-close rule on one page, on the last
  of three pages, with an action, and while paused; no chatter while the bubble or paste box
  is open or motion is paused; wake on touch.
- `test_config`: defaults, missing file, malformed JSON, wrong types, unknown `v`, an
  unwritable folder, a round trip.
- `test_sound`: the sample count for 180 ms, peak below full scale, silence at both ends, and
  the frequency near 30 ms, 60 ms and 150 ms measured from zero crossings.
- `test_build`: building into a temporary folder twice gives identical bytes; the committed
  `build-a-duck.pyzw` has exactly the entry names a fresh build has, and each entry's
  uncompressed content equals the source file's. (Contents are compared, not raw bytes,
  because the compressed bytes can differ between Python builds.) An import scan with `ast`
  over every source file finds only standard-library modules (`sys.stdlib_module_names`) and
  the package itself.

**Self-test.** `--selftest` uses a temporary settings folder, plays no sound, creates the real
windows with the Classic duck, and drives the program's own handlers on a short timer. After
each step it checks the stated result and stops with exit code 1 and a message on standard
error at the first that fails; otherwise exit code 0.

| Step | Checked afterwards |
|---|---|
| start | the duck window exists, is `36 * scale` px square, and sits on the ground |
| click | state `squeaking`; the bubble is open with one page |
| second click | the bubble shows the prompt line and a "Paste code" button |
| press "Paste code" | the paste box exists; the bubble is closed |
| enter `int x = 1` on one line and `x++;` on the next as Java, press "Ask the duck" | state `thinking`, then a bubble whose text came from a `semicolon` finding |
| drag 200 px up and release while that bubble is open | `carried` while held; no `falling` or `landing`; the duck is on the ground |
| press Close, then drag 200 px up and release | `carried` while held; then `falling`, then `landing`, then the duck is on the ground |
| choose Large | the window is `36 * (medium + 2)` px square |
| load the Classic duck written to a temporary file | the duck's name is "Classic"; the settings file in the temporary folder holds that path |
| load a text file that is not a duck | a message was raised with the `not-json` text; the duck is unchanged |
| quit | both windows are gone |

**Page.** `tests/desktop-page.check.mjs`, a scripted browser check run by hand: the block is present in the Export panel, closed by
default, opens, lists the five steps, and its link fetches a file byte-identical to
`desktop/build-a-duck.pyzw`.

**Checked by hand on the build machine and reported**: double-clicking the `.pyzw`; dropping
a duck file onto it; that a real click, double-click, drag and right-click reach the handlers
the self-test drives; that clicks beside the duck's pixels go to the window underneath.

**Not verified by this work**: how the duck looks and sounds (the user judges that by running
it); a fresh Python install from python.org on another Windows machine; SmartScreen's
behaviour on a downloaded copy.

## 14. Acceptance criteria

1. `py desktop/build-a-duck.pyzw` on Windows shows the Classic duck on the ground, with only
   its own pixels visible, on top of other windows (or the remembered duck, once one has been
   loaded).
2. `py desktop/build-a-duck.pyzw my.duck.json` shows that duck with its palette, frames,
   animations, personality, languages and walking mode.
3. A file that does not load gives section 6's message and leaves the current duck in place.
4. The duck walks, sleeps and chatters with the timings section 7.4 gives for its sliders.
5. Click, double-click, drag and right-click behave as section 7.5 says.
6. The four walking modes behave as in section 7.3.
7. Pasted code gets the findings section 9 defines, spoken in the duck's voice by the page's
   wording rules.
8. Mute, Pause motion, Size and the last duck are remembered between runs.
9. All Python tests pass, `npm test` passes, and the self-test exits 0 from source and from
   the built file.
10. The page's Export panel shows section 12's instructions, and the link serves the built
    file.
11. The program imports only the standard library, and none of `socket`, `urllib`, `http`,
    `ssl`, `ftplib` or `smtplib` (`test_build`'s import scan).

## 15. Order of work

1. Spikes, before anything else, each a throwaway script: a transparent always-on-top window
   that takes clicks only on drawn pixels; a second such window for the bubble; a `.pyzw`
   that starts by double-click and receives a dropped file. If one fails, stop and raise it.
2. The JavaScript changes, the exporter and its freshness test.
3. The pure modules with their parity tests.
4. `loader`, `config`, `sound`, `brain` with their tests.
5. `app.py` and the self-test.
6. The build script, the built file, `test_build`.
7. The page's instructions block and its browser check; README.
8. A build audit covering all of the above, including the web changes in steps 2 and 7.
9. The page and the desktop duck are deployed together, on the user's go-ahead.

The audit of the web page that accepted decision 8 puts first was done on 2026-10-12.

## 16. Risks

- **Browsers, Windows SmartScreen and antivirus** may warn about or block a downloaded `.pyzw`. The
  instructions say so. There is no fix short of a signed installer, which is out of scope.
- **Python not installed, installed from the Microsoft Store, or installed without the
  launcher.** Double-clicking may then do nothing. The README gives the terminal command.
  This path is not tested by this work.
- **Click-through and transparency** depend on tkinter's `-transparentcolor`, which is
  Windows-specific. The first spike checks it.
- **Full-screen programs and other always-on-top windows** may cover the duck or be covered
  by it. Quit is always in the menu.
- **Two implementations of one checker** can drift. The parity file and the freshness test
  are the guard.
- **JavaScript is checked less well here than on the page** (section 3.2 F).
