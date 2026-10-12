"""The windows: the duck, its speech bubble, the paste box and the menu.

All behaviour lives in brain.py. This module turns mouse events into calls on the
brain and draws what the brain reports.
"""
import base64
import math
import os
import random
import tempfile
import time
import tkinter as tk
from tkinter import filedialog, font as tkfont, messagebox, ttk

from . import config as config_module
from . import sound, win
from .brain import ART_SIDE, MARGIN, DuckBrain
from .loader import MESSAGES, load_duck_file
from .personality import is_buddy
from .syntax import LANGUAGE_ORDER, guess_language

TITLE = "Build-a-Duck"
# One more candidate than a palette can hold, so one is always free.
KEY_COLOURS = tuple(f"#ff{value:02x}fe" for value in range(16))
LANGUAGE_LABELS = {"java": "Java", "javascript": "JavaScript", "python": "Python", "c": "C/C++"}
SIZES = ("small", "medium", "large")
TICK_MS = 33
WORK_AREA_EVERY_MS = 2000
NOTICE = "Syntax check only. Your code is not sent anywhere."


def half_up(value):
    return int(math.floor(value + 0.5))


def key_colour(palette):
    """A colour the duck does not use, made transparent so only its pixels show."""
    used = {colour.lower() for colour in palette}
    return next(colour for colour in KEY_COLOURS if colour not in used)


def scale_for(size, ui):
    medium = max(2, half_up(3 * ui))
    return {"small": max(2, medium - 1), "medium": medium, "large": medium + 2}[size]


def frame_rows(frame):
    data = base64.b64decode(frame + "=" * (-len(frame) % 4))
    return [data[row * 32:(row + 1) * 32] for row in range(32)]


class DuckApp:
    def __init__(self, duck, pool, settings, settings_folder, play_sound=True):
        self.duck = duck
        self.settings = dict(settings)
        self.settings_folder = settings_folder
        self.play_sound = play_sound
        self.messages = []               # every message shown, for the self-test
        self.quiet_messages = False      # the self-test records messages without a box
        self.ui = win.system_dpi() / 96
        self.scale = scale_for(self.settings["size"], self.ui)

        self.root = tk.Tk()
        self.root.title(TITLE)
        self.key = key_colour(duck["palette"])
        self._shape_window(self.root)
        self.canvas = tk.Canvas(self.root, highlightthickness=0, bd=0, cursor="hand2")
        self.canvas.pack()
        self.sprite = self.canvas.create_image(0, 0, anchor="nw")
        self.canvas.bind("<ButtonPress-1>", self.on_press)
        self.canvas.bind("<B1-Motion>", self.on_move)
        self.canvas.bind("<ButtonRelease-1>", self.on_release)
        self.canvas.bind("<Button-3>", self.on_menu)

        self.bubble_window = None
        self.bubble_canvas = None
        self.bubble_shown = None         # what the bubble window currently shows
        self.bubble_layout = None        # sizes measured for the page now showing
        self.bubble_buttons = {}         # label -> centre of the button on the bubble canvas
        self.menu = None
        self.bubble_place = None
        self.paste_window = None
        self.images = {}

        self.squeak_path = os.path.join(tempfile.gettempdir(), "buildaduck-squeak.wav")
        if play_sound:
            try:
                sound.write_squeak(self.squeak_path)
            except Exception:
                self.play_sound = False

        self.bounds = win.work_area() or (0, 0, self.root.winfo_screenwidth(), self.root.winfo_screenheight())
        self.bounds_checked = time.monotonic()
        self.brain = DuckBrain(duck, pool, self.bounds, self.scale,
                               lambda: time.monotonic() * 1000, random.random, ui=self.ui,
                               double_click_ms=win.double_click_ms())
        self.brain.set_muted(self.settings["muted"])
        self.brain.set_paused(self.settings["paused"])
        self._rebuild_images()
        self.draw()
        self.closed = False
        self.root.after(TICK_MS, self.tick)

    # ── Windows and drawing ──────────────────────────────────────────────────

    def _shape_window(self, window):
        window.overrideredirect(True)
        window.wm_attributes("-topmost", True)
        window.wm_attributes("-toolwindow", True)
        window.wm_attributes("-transparentcolor", self.key)
        window.configure(bg=self.key)

    def px(self, value):
        return half_up(value * self.ui)

    def _rebuild_images(self):
        self.key = key_colour(self.duck["palette"])
        for window in (self.root, self.bubble_window):
            if window is not None:
                window.wm_attributes("-transparentcolor", self.key)
                window.configure(bg=self.key)
        side = ART_SIDE * self.scale
        self.canvas.configure(width=side, height=side, bg=self.key)
        colours = [self.key] + list(self.duck["palette"])
        self.images = {}
        for index, frame in enumerate(self.duck["frames"]):
            rows = frame_rows(frame)
            for flipped in (False, True):
                image = tk.PhotoImage(width=32, height=32)
                lines = []
                for row in rows:
                    cells = reversed(row) if flipped else row
                    lines.append("{" + " ".join(colours[value] for value in cells) + "}")
                image.put(" ".join(lines))
                self.images[(index, flipped)] = image.zoom(self.scale)
        self.bubble_shown = None   # sizes may have changed; redraw the bubble too
        self.bubble_layout = None

    def draw(self):
        brain = self.brain
        shown = brain.shown
        self.canvas.itemconfigure(self.sprite, image=self.images[(shown["frame"], brain.facing_left)])
        dx = -shown["dx"] if brain.facing_left else shown["dx"]
        self.canvas.coords(self.sprite, (MARGIN + dx) * self.scale, (MARGIN + shown["dy"]) * self.scale)
        side = ART_SIDE * self.scale
        self.root.geometry(f"{side}x{side}+{int(round(brain.x))}+{int(round(brain.y))}")
        self._draw_bubble()

    # ── Speech bubble ────────────────────────────────────────────────────────

    def _draw_bubble(self):
        bubble = self.brain.bubble
        if bubble is None:
            if self.bubble_window is not None:
                self.bubble_window.destroy()
                self.bubble_window = self.bubble_canvas = self.bubble_shown = self.bubble_place = None
                self.bubble_layout = None
            return
        if self.bubble_window is None:
            self.bubble_window = tk.Toplevel(self.root)
            self._shape_window(self.bubble_window)
            self.bubble_canvas = tk.Canvas(self.bubble_window, highlightthickness=0, bd=0, bg=self.key)
            self.bubble_canvas.pack()

        side = ART_SIDE * self.scale
        left, top, right, bottom = self.bounds
        duck_x, duck_y = int(round(self.brain.x)), int(round(self.brain.y))
        border, gap, pad = self.px(4), self.px(10), self.px(12)
        tail_height = 2 * border
        text_font = tkfont.Font(family="Consolas", size=11)
        small_font = tkfont.Font(family="Consolas", size=10)

        # Measure the text once per page; the answer is kept until the page changes.
        content = (bubble["text"], bubble["index"], bubble["count"], bubble["action"], bubble["has_next"], self.scale)
        if not self.bubble_layout or self.bubble_layout[0] != content:
            probe = self.bubble_canvas.create_text(0, 0, text=bubble["text"], font=text_font, width=self.px(320), anchor="nw")
            x0, y0, x1, y1 = self.bubble_canvas.bbox(probe)
            self.bubble_canvas.delete(probe)
            self.bubble_layout = (content, x1 - x0, y1 - y0)
        _, text_w, text_h = self.bubble_layout
        buttons = []
        if bubble["action"]:
            buttons.append((bubble["action"], self.on_bubble_action))
        if bubble["has_next"]:
            buttons.append(("Next", self.on_bubble_next))
        buttons.append(("Close", self.on_bubble_close))
        button_h = small_font.metrics("linespace") + self.px(8)
        button_ws = [small_font.measure(label) + self.px(16) for label, _ in buttons]
        count_text = f"{bubble['index'] + 1} of {bubble['count']}" if bubble["count"] > 1 else ""
        row_w = sum(button_ws) + self.px(6) * (len(buttons) - 1) + (small_font.measure(count_text) + self.px(12) if count_text else 0)
        inner_w = max(text_w, row_w, self.px(120))
        box_w = inner_w + 2 * pad + 2 * border
        box_h = text_h + self.px(8) + button_h + 2 * pad + 2 * border

        above = duck_y - gap - tail_height - box_h >= top
        centre = duck_x + side // 2
        box_x = min(max(left + self.px(8), centre - box_w // 2), right - box_w - self.px(8))
        box_x = max(left, box_x)
        if above:
            window_y = duck_y - gap - tail_height - box_h
            box_top = 0
        else:
            window_y = min(duck_y + side + gap, bottom - box_h - tail_height)
            box_top = tail_height
        tail_x = min(max(self.px(16), centre - box_x - self.px(6)), box_w - self.px(16) - self.px(12))

        signature = (bubble["text"], bubble["index"], bubble["count"], bubble["action"], bubble["has_next"],
                     above, tail_x, self.scale, self.key)
        if signature != self.bubble_shown:
            canvas = self.bubble_canvas
            canvas.delete("all")
            canvas.configure(width=box_w, height=box_h + tail_height, bg=self.key)
            black, white = "#000000", "#ffffff"
            b = border
            # The page's box: four bars for the border, with the corner squares left empty.
            canvas.create_rectangle(b, box_top + b, box_w - b, box_top + box_h - b, fill=white, outline=white)
            canvas.create_rectangle(b, box_top, box_w - b, box_top + b, fill=black, outline=black)
            canvas.create_rectangle(b, box_top + box_h - b, box_w - b, box_top + box_h, fill=black, outline=black)
            canvas.create_rectangle(0, box_top + b, b, box_top + box_h - b, fill=black, outline=black)
            canvas.create_rectangle(box_w - b, box_top + b, box_w, box_top + box_h - b, fill=black, outline=black)
            # The tail: a bar and a square beyond it, pointing at the duck.
            bar_w = self.px(12)
            if above:
                canvas.create_rectangle(tail_x, box_h, tail_x + bar_w, box_h + b, fill=black, outline=black)
                canvas.create_rectangle(tail_x + b, box_h + b, tail_x + 2 * b, box_h + 2 * b, fill=black, outline=black)
            else:
                canvas.create_rectangle(tail_x, b, tail_x + bar_w, 2 * b, fill=black, outline=black)
                canvas.create_rectangle(tail_x + b, 0, tail_x + 2 * b, b, fill=black, outline=black)
            canvas.create_text(b + pad, box_top + b + pad, text=bubble["text"], font=text_font,
                               width=self.px(320), anchor="nw", fill="#111111")
            row_y = box_top + b + pad + text_h + self.px(8)
            if count_text:
                canvas.create_text(b + pad, row_y + button_h // 2, text=count_text, font=small_font, anchor="w", fill="#111111")
            x = box_w - b - pad
            self.bubble_buttons = {}
            for number, ((label, handler), width) in enumerate(reversed(list(zip(buttons, button_ws)))):
                tag = f"button-{number}"   # a tag with a space in it would be read as two tags
                self.bubble_buttons[label] = (x - width // 2, row_y + button_h // 2)
                canvas.create_rectangle(x - width, row_y, x, row_y + button_h, fill=white, outline=black, width=max(1, self.px(2)), tags=tag)
                canvas.create_text(x - width // 2, row_y + button_h // 2, text=label, font=small_font, fill="#111111", tags=tag)
                canvas.tag_bind(tag, "<Button-1>", lambda _event, run=handler: run())
                x -= width + self.px(6)
            self.bubble_shown = signature
        place = (box_x, window_y, box_w, box_h + tail_height)
        if place != self.bubble_place:
            self.bubble_window.geometry(f"{place[2]}x{place[3]}+{place[0]}+{place[1]}")
            self.bubble_place = place

    def press_bubble_button(self, label):
        """Clicks one of the bubble's buttons through the canvas, as the mouse would."""
        x, y = self.bubble_buttons[label]
        self.bubble_canvas.event_generate("<Motion>", x=x, y=y)
        self.bubble_canvas.event_generate("<Button-1>", x=x, y=y)
        if self.bubble_canvas is not None:   # the press may have closed the bubble
            self.bubble_canvas.event_generate("<ButtonRelease-1>", x=x, y=y)
        self.root.update()

    def on_bubble_next(self):
        self.brain.on_bubble_next()
        self.after_event()

    def on_bubble_close(self):
        self.brain.on_bubble_close()
        self.after_event()

    def on_bubble_action(self):
        self.brain.on_bubble_action()
        self.after_event()

    # ── Mouse ────────────────────────────────────────────────────────────────

    def on_press(self, event):
        self.brain.on_press(event.x_root, event.y_root)
        self.after_event()

    def on_move(self, event):
        self.brain.on_move(event.x_root, event.y_root)
        self.canvas.configure(cursor="fleur" if self.brain.dragging else "hand2")
        self.after_event()

    def on_release(self, event):
        self.brain.on_release(event.x_root, event.y_root)
        self.canvas.configure(cursor="hand2")
        self.after_event()

    def after_event(self):
        """Acts on what the brain asked for, then redraws."""
        if self.brain.squeak:
            self.brain.squeak = False
            if self.play_sound:
                sound.play(self.squeak_path)
        if self.brain.wants_paste_box:
            self.open_paste_box()
        self.draw()

    # ── Menu ─────────────────────────────────────────────────────────────────

    def build_menu(self):
        if self.menu is not None:
            self.menu.destroy()   # also destroys its submenu
        menu = self.menu = tk.Menu(self.root, tearoff=0)
        if not is_buddy(self.duck["personality"]):
            menu.add_command(label="Paste code...", command=self.menu_paste)
        self.mute_var = tk.BooleanVar(value=self.settings["muted"])
        self.pause_var = tk.BooleanVar(value=self.settings["paused"])
        menu.add_checkbutton(label="Mute", variable=self.mute_var, command=lambda: self.set_muted(self.mute_var.get()))
        menu.add_checkbutton(label="Pause motion", variable=self.pause_var, command=lambda: self.set_paused(self.pause_var.get()))
        sizes = tk.Menu(menu, tearoff=0)
        self.size_var = tk.StringVar(value=self.settings["size"])
        for size in SIZES:
            sizes.add_radiobutton(label=size.capitalize(), value=size, variable=self.size_var,
                                  command=lambda: self.set_size(self.size_var.get()))
        menu.add_cascade(label="Size", menu=sizes)
        menu.add_command(label="Load another duck...", command=self.menu_load)
        menu.add_separator()
        menu.add_command(label="Quit", command=self.quit)
        return menu

    def on_menu(self, event):
        self.brain.on_menu()
        menu = self.build_menu()
        try:
            menu.tk_popup(event.x_root, event.y_root)
        finally:
            menu.grab_release()

    def menu_paste(self):
        self.brain.ask_for_paste_box()
        self.after_event()

    def set_muted(self, flag):
        self.settings["muted"] = bool(flag)
        self.brain.set_muted(flag)
        self.save_settings()

    def set_paused(self, flag):
        self.settings["paused"] = bool(flag)
        self.brain.set_paused(flag)
        self.save_settings()
        self.draw()

    def set_size(self, size):
        self.settings["size"] = size
        self.scale = scale_for(size, self.ui)
        self.brain.set_scale(self.scale)
        self._rebuild_images()
        self.save_settings()
        self.draw()

    def menu_load(self):
        path = filedialog.askopenfilename(parent=self.root, title="Load a duck file",
                                          filetypes=[("Duck files", "*.duck.json"), ("JSON files", "*.json")])
        if path:
            self.load_duck(path)

    def load_duck(self, path):
        """Loads a duck file. Returns True if it became the duck."""
        status, value = load_duck_file(path)
        if status != "ok":
            self.show_message(MESSAGES[value])
            return False
        if self.paste_window is not None:
            self.close_paste_box(None)   # its language list belongs to the duck being replaced
        self.duck = value
        self.brain.set_duck(value)
        self._rebuild_images()
        self.settings["duckPath"] = os.path.abspath(path)
        self.save_settings()
        self.draw()
        return True

    def show_message(self, text):
        self.messages.append(text)
        if not self.quiet_messages:
            messagebox.showinfo(TITLE, text, parent=self.root)

    def save_settings(self):
        config_module.save_config(self.settings_folder, self.settings)

    # ── Paste box ────────────────────────────────────────────────────────────

    def offered_languages(self):
        chosen = [language for language in LANGUAGE_ORDER if language in self.duck["languages"]]
        return chosen or list(LANGUAGE_ORDER)

    def open_paste_box(self):
        if self.paste_window is not None:
            self.brain.wants_paste_box = False
            self.paste_window.lift()
            self.paste_window.focus_force()
            return
        self.brain.on_paste_opened()
        window = tk.Toplevel(self.root)
        self.paste_window = window
        window.title(f"Paste code for {self.duck['name'] or 'Duck'}")
        window.wm_attributes("-topmost", True)
        window.protocol("WM_DELETE_WINDOW", lambda: self.close_paste_box(None))
        offered = self.paste_offered = self.offered_languages()
        self.paste_language_touched = False

        top = ttk.Frame(window, padding=self.px(10))
        top.pack(fill="both", expand=True)
        row = ttk.Frame(top)
        row.pack(fill="x")
        ttk.Label(row, text="Language").pack(side="left")
        self.paste_language = ttk.Combobox(row, state="readonly", width=14,
                                           values=[LANGUAGE_LABELS[language] for language in offered])
        self.paste_language.current(0)
        self.paste_language.pack(side="left", padx=self.px(8))
        self.paste_language.bind("<<ComboboxSelected>>", lambda _event: setattr(self, "paste_language_touched", True))
        text_frame = ttk.Frame(top)
        text_frame.pack(fill="both", expand=True, pady=self.px(8))
        self.paste_text = tk.Text(text_frame, width=72, height=18, wrap="none", font=("Consolas", 10), undo=True)
        scroll = ttk.Scrollbar(text_frame, command=self.paste_text.yview)
        self.paste_text.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self.paste_text.pack(side="left", fill="both", expand=True)
        self.paste_text.bind("<<Modified>>", self.on_paste_modified)
        # tkinter's text box has no right-click menu of its own, and people paste that way.
        edit = tk.Menu(window, tearoff=0)
        edit.add_command(label="Cut", command=lambda: self.paste_text.event_generate("<<Cut>>"))
        edit.add_command(label="Copy", command=lambda: self.paste_text.event_generate("<<Copy>>"))
        edit.add_command(label="Paste", command=lambda: self.paste_text.event_generate("<<Paste>>"))
        edit.add_separator()
        edit.add_command(label="Select all", command=lambda: self.paste_text.tag_add("sel", "1.0", "end-1c"))
        self.paste_edit_menu = edit

        def show_edit_menu(event):
            self.paste_text.focus_set()
            try:
                edit.tk_popup(event.x_root, event.y_root)
            finally:
                edit.grab_release()

        self.paste_text.bind("<Button-3>", show_edit_menu)
        ttk.Label(top, text=NOTICE).pack(anchor="w")
        buttons = ttk.Frame(top)
        buttons.pack(fill="x", pady=(self.px(8), 0))
        ttk.Button(buttons, text="Cancel", command=lambda: self.close_paste_box(None)).pack(side="right")
        ttk.Button(buttons, text="Ask the duck (Ctrl+Enter)", command=self.paste_ask).pack(side="right", padx=self.px(8))
        window.bind("<Escape>", lambda _event: self.close_paste_box(None))
        # Tab types a tab in the code box, so asking needs a key of its own.
        window.bind("<Control-Return>", lambda _event: (self.paste_ask(), "break")[1])
        self.paste_text.focus_set()
        self.draw()

    def paste_code(self):
        return self.paste_text.get("1.0", "end-1c")

    def paste_language_code(self):
        return self.paste_offered[max(0, self.paste_language.current())]

    def on_paste_modified(self, _event=None):
        if self.paste_window is None:
            return
        self.paste_text.edit_modified(False)
        if not self.paste_language_touched:
            offered = self.paste_offered
            self.paste_language.current(offered.index(guess_language(self.paste_code(), offered)))

    def paste_ask(self):
        self.close_paste_box(self.paste_code())

    def close_paste_box(self, text):
        if self.paste_window is None:
            return
        language = self.paste_language_code()
        self.paste_window.destroy()
        self.paste_window = None
        self.brain.on_paste_closed(text, language)
        self.draw()

    # ── Loop ─────────────────────────────────────────────────────────────────

    def tick(self):
        if self.closed:
            return
        now = time.monotonic()
        if (now - self.bounds_checked) * 1000 >= WORK_AREA_EVERY_MS:
            self.bounds_checked = now
            area = win.work_area()
            if area and area != self.bounds:
                self.bounds = area
                self.brain.set_bounds(area)
        self.brain.tick()
        self.after_event()
        self.root.after(TICK_MS, self.tick)

    def quit(self):
        self.closed = True
        self.root.destroy()

    def run(self):
        self.root.mainloop()
