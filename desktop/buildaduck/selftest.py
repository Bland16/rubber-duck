"""--selftest: starts the real windows and drives the program's own handlers.

It uses a temporary settings folder and plays no sound. Each step does something
and then states what must be true; the first step that fails ends the run with
exit code 1 and a message on standard error.
"""
import json
import os
import shutil
import sys
import tempfile
import time

from . import config, win
from .app import DuckApp
from .brain import ART_SIDE, LANDING_MS, THINKING_MS
from .loader import MESSAGES, read_json

JAVA = "int x = 1\nx++;\n"


class Pointer:
    """Stands in for a tkinter mouse event."""

    def __init__(self, x, y):
        self.x_root = int(x)
        self.y_root = int(y)


def run_selftest():
    win.make_dpi_aware()
    folder = tempfile.mkdtemp(prefix="buildaduck-selftest-")
    classic = read_json("classic.duck.json")
    app = DuckApp(classic, read_json("responses.json"), dict(config.DEFAULTS), folder, play_sound=False)
    app.quiet_messages = True
    brain = app.brain
    failures = []
    state = {"medium": app.scale, "seen": set()}

    def crashed(exc_type, exc, trace):
        import traceback
        failures.append("exception: " + "".join(traceback.format_exception(exc_type, exc, trace)).strip().splitlines()[-1])
        finish()

    app.root.report_callback_exception = crashed

    def need(condition, what):
        if not condition:
            raise AssertionError(what)

    def ground():
        return app.bounds[3] - ART_SIDE * app.scale + 2 * app.scale

    def press():
        app.on_press(Pointer(brain.x + 20, brain.y + 20))

    def click():
        press()
        app.on_release(Pointer(brain.x + 20, brain.y + 20))

    def drag_up():
        press()
        app.on_move(Pointer(brain.x + 20, brain.y + 20 - app.px(200)))
        state["seen"] = set()

    def release():
        app.on_release(Pointer(brain.x + 20, brain.y + 20))

    def watch():
        state["seen"].add(brain.state)

    # (wait before in ms, action, check). Waits let the real clock move the brain on.
    def check_start():
        app.root.update_idletasks()
        side = ART_SIDE * app.scale
        need(app.root.winfo_width() == side and app.root.winfo_height() == side, f"window is not {side}px square")
        need(abs(brain.y - ground()) < 1, "the duck is not on the ground")

    def check_click():
        need(brain.state == "squeaking", f"state after click is {brain.state}")
        need(brain.bubble and brain.bubble["count"] == 1, "no one-page bubble after a click")
        need(app.bubble_window is not None, "the bubble window was not created")

    def check_second_click():
        need(brain.bubble and brain.bubble["text"].startswith("You look like you're stuck"), "no prompt line")
        need(brain.bubble["action"] == "Paste code", "no Paste code button")

    def check_paste_box():
        need(app.paste_window is not None, "the paste box did not open")
        need(brain.bubble is None, "the bubble stayed open")

    def ask_java():
        app.paste_text.insert("1.0", JAVA)
        app.on_paste_modified()
        app.paste_language.current(app.offered_languages().index("java"))
        app.paste_language_touched = True
        app.paste_ask()

    def check_thinking():
        need(brain.state == "thinking", f"state after asking is {brain.state}")

    def check_answer():
        need(brain.bubble is not None, "no answer bubble")
        need(brain.state == "talking", f"state with the answer is {brain.state}")
        text = brain.bubble["text"]
        from .picker import fill
        pool = read_json("responses.json")
        lines = set()
        for key, options in pool.items():
            if ".semicolon." in key:
                lines.update(fill(option, app.duck, 1) for option in options)
        need(text in lines, f"the answer is not a semicolon line: {text!r}")

    def check_carried():
        need(brain.dragging and brain.animation == "carried", "not carried while held")

    def check_no_landing():
        need("falling" not in state["seen"] and "landing" not in state["seen"], "landed while talking")
        need(abs(brain.y - ground()) < 1, "not on the ground after a drop while talking")

    def check_landed():
        need("falling" in state["seen"], "did not fall")
        need("landing" in state["seen"], "did not land")
        need(abs(brain.y - ground()) < 1, "not on the ground after landing")

    def choose_large():
        app.set_size("large")

    def check_large():
        app.root.update_idletasks()
        side = ART_SIDE * (state["medium"] + 2)
        need(app.root.winfo_width() == side, f"large window is {app.root.winfo_width()}px, not {side}px")

    def load_classic():
        path = os.path.join(folder, "classic-copy.duck.json")
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(classic, handle)
        state["path"] = path
        need(app.load_duck(path), "the Classic duck file did not load")

    def check_loaded():
        need(app.duck["name"] == "Classic", "the duck's name is not Classic")
        saved = config.load_config(folder)
        need(saved["duckPath"] == os.path.abspath(state["path"]), "the settings do not hold the duck's path")

    def load_text():
        path = os.path.join(folder, "notes.txt")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write("this is not a duck")
        need(not app.load_duck(path), "a text file loaded as a duck")

    def check_refused():
        need(app.messages and app.messages[-1] == MESSAGES["not-json"], "no 'not a duck file' message")
        need(app.duck["name"] == "Classic", "the duck changed after a failed load")

    steps = [
        (300, None, check_start),
        (0, click, check_click),
        (150, click, check_second_click),
        (100, app.on_bubble_action, check_paste_box),
        (100, ask_java, check_thinking),
        (THINKING_MS + 300, None, check_answer),
        (100, drag_up, check_carried),
        (0, release, None),
        (600, None, check_no_landing),
        (0, app.on_bubble_close, None),
        (100, drag_up, check_carried),
        (0, release, None),
        (LANDING_MS + 1800, None, check_landed),
        (0, choose_large, check_large),
        (0, load_classic, check_loaded),
        (0, load_text, check_refused),
    ]

    def finish():
        if not app.closed:
            app.quit()

    def run_step(index):
        if failures or app.closed:
            return
        if index >= len(steps):
            finish()
            return
        _, action, check = steps[index]
        try:
            if action:
                action()
            if check:
                check()
        except AssertionError as error:
            failures.append(f"step {index + 1}: {error}")
            finish()
            return
        wait = steps[index + 1][0] if index + 1 < len(steps) else 0
        app.root.after(wait, lambda: run_step(index + 1))

    def watcher():
        if not app.closed:
            watch()
            app.root.after(10, watcher)

    started = time.monotonic()
    app.root.after(steps[0][0], lambda: run_step(0))
    app.root.after(10, watcher)
    app.root.after(30000, lambda: (failures.append("timed out"), finish()))
    app.run()
    shutil.rmtree(folder, ignore_errors=True)

    gone = app.closed
    if not gone:
        failures.append("the windows were not closed")
    if failures:
        if sys.stderr is not None:
            print("selftest FAILED: " + "; ".join(failures), file=sys.stderr)
        return 1
    if sys.stdout is not None:
        print(f"selftest ok ({len(steps)} steps, {time.monotonic() - started:.1f} s)")
    return 0
