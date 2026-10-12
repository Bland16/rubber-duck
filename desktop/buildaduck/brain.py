"""The duck's behaviour: where it is, what it is doing and what it is saying.

A port of the state machine in js/stage.js with the page taken out. Nothing here
touches tkinter: app.py feeds in mouse events and the clock, and draws what the
fields say. The tests drive it with a fake clock and fixed random numbers.
"""
import math

from .motion import frame_at
from .personality import behaviour, is_buddy
from .picker import buddy_key, chatter_key, compose_hunches, create_picker, extra_sentence, fill

PROMPT = "You look like you're stuck, paste your code for a check"
THINKING_MS = 800
LANDING_MS = 700
SQUEAK_MIN_MS = 300
NAP_MS = 60000
FALL_SPEED = 900        # px per second at scale 3
MAX_TICK_MS = 100       # one tick never moves the duck further than this much time
DOUBLE_CLICK_MS = 500
DRAG_PX = 6
SIT_INSET = 16
START_X = 40
ART_SIDE = 32 + 2 * 2   # a frame plus the motion margin on each side
MARGIN = 2


def _half_up(value):
    return int(math.floor(value + 0.5))


class DuckBrain:
    def __init__(self, duck, pool, bounds, scale, clock, rng, ui=1.0, check=None,
                 double_click_ms=DOUBLE_CLICK_MS):
        self.duck = duck
        self.bounds = tuple(bounds)
        self.scale = scale
        self.ui = ui
        self._clock = clock
        self._rng = rng
        self._check = check
        self._double_click_ms = double_click_ms
        self._picker = create_picker(pool, rng)
        now = clock()
        self.state = "idle"
        self.step = 0
        self.facing_left = False
        self.paused = False
        self.muted = False
        self.squeak = False
        self.wants_paste_box = False
        self._state_since = now
        self._last_step_at = now
        self._last_tick = now
        self._last_touch = now
        self._last_speech_closed = now
        self._target = None
        self._sit_spot = None
        self._bubble = None
        self._grab = None
        self._dragging = False
        self._paste_open = False
        self._pending = None            # the answer waiting for the thinking pause to end
        self._click_count = 0
        self._last_click_at = None
        left, _, _, _ = self.bounds
        self.x = min(left + START_X * scale / 3, self._max_x())
        self.y = self._ground_y()

    # ── Geometry ─────────────────────────────────────────────────────────────

    @property
    def side(self):
        return ART_SIDE * self.scale

    def _ground_y(self):
        # The margin under the art is let hang below the edge, so the feet touch it.
        return self.bounds[3] - self.side + MARGIN * self.scale

    def _max_x(self):
        return max(self.bounds[0], self.bounds[2] - self.side)

    def _mode(self):
        roam = self.duck["roam"]
        return "strip" if roam == "path" else roam   # a drawn path is not in the file

    def _sit_place(self):
        if self._sit_spot:
            return self._sit_spot
        inset = _half_up(SIT_INSET * self.ui)
        return (max(self.bounds[0], self.bounds[2] - self.side - inset), self.bounds[1] + inset)

    def _clamp(self, free):
        left, top, _, _ = self.bounds
        self.x = min(max(left, self.x), self._max_x())
        if free:
            self.y = min(max(top, self.y), self._ground_y())
        else:
            self.y = self._ground_y()

    def _rest(self):
        """Puts a duck that is not moving where its mode lets it stand."""
        mode = self._mode()
        if self.paused:
            if mode == "sit":
                self.x, self.y = self._sit_place()
            self._clamp(free=mode == "sit")
        else:
            self._clamp(free=mode != "strip")

    def _choose_target(self):
        left, top, _, _ = self.bounds
        mode = self._mode()
        if mode == "sit":
            spot = self._sit_place()
            if math.hypot(spot[0] - self.x, spot[1] - self.y) < 1:
                return None
            return spot
        x = left + self._rng() * (self._max_x() - left)
        if mode == "page":
            return (x, top + self._rng() * max(0, self._ground_y() - top))
        return (x, self._ground_y())

    # ── What app.py reads ────────────────────────────────────────────────────

    @property
    def animation(self):
        if self._dragging or self.state == "falling":
            return "carried"
        return {"landing": "landing", "walking": "walk", "sleeping": "sleep",
                "squeaking": "squeak", "thinking": "thinking"}.get(self.state, "idle")

    @property
    def shown(self):
        """The frame and motion offset to draw now: {"frame", "dx", "dy"}."""
        return frame_at(self.duck["animations"][self.animation], self.step, self.paused)

    @property
    def bubble(self):
        if not self._bubble:
            return None
        pages = self._bubble["pages"]
        index = self._bubble["index"]
        return {"text": pages[index], "index": index, "count": len(pages),
                "action": self._bubble["action"], "has_next": index < len(pages) - 1}

    @property
    def dragging(self):
        return self._dragging

    # ── State machine ────────────────────────────────────────────────────────

    def _enter(self, state, now):
        self.state = state
        self._state_since = now
        self.step = 0
        self._last_step_at = now

    def _maybe_chatter(self, now):
        every = behaviour(self.duck["personality"])["chatterEveryMs"]
        if (not self.paused and every is not None and now - self._last_speech_closed >= every
                and not self._paste_open and not self._bubble):
            self._say([self._chatter_line()], now=now)

    def _enter_idle(self, now):
        self._enter("idle", now)
        self._maybe_chatter(now)

    def _walk_to(self, target, now):
        self._target = target
        if abs(target[0] - self.x) > 1:
            self.facing_left = target[0] < self.x
        self._enter("walking", now)

    def _sequence_ms(self):
        animation = self.duck["animations"][self.animation]
        return len(animation["seq"]) * 1000 / animation["fps"]

    def tick(self):
        now = self._clock()
        self.squeak = False
        numbers = behaviour(self.duck["personality"])
        still = self.paused
        animation = self.duck["animations"][self.animation]
        if not still and now - self._last_step_at >= 1000 / animation["fps"]:
            self._last_step_at = now
            self.step += 1
        dt = min(MAX_TICK_MS, now - self._last_tick) / 1000
        speed_scale = self.scale / 3

        if self._bubble and self._bubble["close_at"] is not None and now >= self._bubble["close_at"]:
            self._close_bubble(now)

        # The answer is spoken when it is due, whatever the duck is doing by then (a
        # click during the pause must not lose it). It waits while the paste box is open.
        if self._pending and now >= self._pending["due"] and not self._paste_open:
            result, language = self._pending["result"], self._pending["language"]
            self._pending = None
            if self.state == "thinking":
                self._enter("idle", now)
            lines = compose_hunches(result, self.duck, self._picker)
            extra = extra_sentence(result, language)
            if extra:
                lines[-1] = f"{lines[-1]} {extra}"
            self._say(lines, now=now)

        if self._dragging:
            pass  # the pointer is in charge
        elif self.state == "idle" and not still and not self._paste_open:
            if now - self._last_touch > numbers["sleepAfterMs"]:
                self._enter("sleeping", now)
            elif now - self._state_since > numbers["idlePauseMs"]:
                target = self._choose_target()
                if target:
                    self._walk_to(target, now)
                else:
                    self._state_since = now   # staying put: the pause still ends
                    self._maybe_chatter(now)
        elif self.state == "sleeping":
            if now - self._state_since >= NAP_MS:
                self._last_touch = now        # a nap is followed by a full waking spell
                self._enter_idle(now)
        elif self.state == "walking":
            if still:
                self._rest()
                self._enter_idle(now)
            else:
                dx = self._target[0] - self.x
                dy = self._target[1] - self.y
                distance = math.hypot(dx, dy)
                travel = numbers["walkSpeed"] * speed_scale * dt
                if distance <= travel:
                    self.x, self.y = self._target
                    self._enter_idle(now)
                else:
                    self.x += dx / distance * travel
                    self.y += dy / distance * travel
        elif self.state == "falling":
            ground = self._ground_y()
            self.y = ground if still else min(ground, self.y + FALL_SPEED * speed_scale * dt)
            if self.y >= ground:
                self._enter("landing", now)
        elif self.state == "landing":
            if now - self._state_since >= max(LANDING_MS, self._sequence_ms()):
                self._rest()
                if self._bubble:
                    self._enter("talking", now)
                else:
                    self._enter_idle(now)
        elif self.state == "squeaking":
            if now - self._state_since >= max(SQUEAK_MIN_MS, self._sequence_ms()):
                if self._bubble:
                    self._enter("talking", now)
                else:
                    self._enter_idle(now)

        self._last_tick = now

    # ── Speech ───────────────────────────────────────────────────────────────

    def _arm(self, now):
        """Sets or clears the auto-close time for the page now showing."""
        bubble = self._bubble
        last_page = bubble["index"] >= len(bubble["pages"]) - 1
        if bubble["action"] is None and last_page and not self.paused:
            bubble["close_at"] = now + 4000 + 60 * len(bubble["pages"][bubble["index"]])
        else:
            bubble["close_at"] = None

    def _say(self, pages, action=None, now=None):
        now = self._clock() if now is None else now
        self._bubble = {"pages": list(pages), "index": 0, "action": action, "close_at": None}
        self._arm(now)
        if self.state in ("idle", "walking", "sleeping"):
            self._enter("talking", now)

    def _close_bubble(self, now):
        if not self._bubble:
            return
        self._bubble = None
        self._last_speech_closed = now
        if self.state == "talking":
            self._enter("idle", now)

    def _chatter_line(self):
        personality = self.duck["personality"]
        about_code = (not is_buddy(personality)
                      and self._rng() < behaviour(personality)["codeChatterChance"])
        return fill(self._picker.pick(chatter_key(self.duck, about_code)), self.duck, "")

    def on_bubble_next(self):
        if self._bubble and self._bubble["index"] < len(self._bubble["pages"]) - 1:
            self._bubble["index"] += 1
            self._arm(self._clock())

    def on_bubble_close(self):
        self._close_bubble(self._clock())

    def on_bubble_action(self):
        if self._bubble and self._bubble["action"]:
            self._close_bubble(self._clock())
            self.ask_for_paste_box()

    # ── Mouse ────────────────────────────────────────────────────────────────

    def _touch(self, now):
        self._last_touch = now
        if self.state == "sleeping":
            self._enter("idle", now)

    def on_press(self, x, y):
        self._touch(self._clock())
        self._grab = {"dx": x - self.x, "dy": y - self.y, "x": x, "y": y}

    def on_move(self, x, y):
        grab = self._grab
        if not grab:
            return
        now = self._clock()
        if not self._dragging:
            if math.hypot(x - grab["x"], y - grab["y"]) < _half_up(DRAG_PX * self.ui):
                return
            self._dragging = True
            if self.state in ("walking", "sleeping", "falling", "landing"):
                self._enter("idle", now)
        self._last_touch = now
        self.x = x - grab["dx"]
        self.y = y - grab["dy"]
        self._clamp(free=True)

    def on_release(self, x, y):
        if not self._grab:
            return
        self._grab = None
        now = self._clock()
        if self._dragging:
            self._dragging = False
            self._drop(now)
        else:
            self._click(now)

    def _drop(self, now):
        self._last_touch = now
        mode = self._mode()
        if mode == "sit":
            self._sit_spot = (self.x, self.y)
        if self.state != "idle":
            self._rest()              # busy talking or thinking: no landing
        elif mode == "strip":
            self._enter("falling", now)
        else:
            self._enter("landing", now)

    def _click(self, now):
        in_run = self._last_click_at is not None and now - self._last_click_at <= self._double_click_ms
        self._click_count = self._click_count + 1 if in_run else 1
        self._last_click_at = now
        if self._click_count == 1:
            self._do_squeak(now)
        elif self._click_count == 2:
            self._do_prompt(now)

    def _do_squeak(self, now):
        if self.state == "falling":
            self.y = self._ground_y()   # finish the fall; the squeak takes over the state
        self.squeak = not self.muted
        self._enter("squeaking", now)
        self._say([self._chatter_line()], now=now)

    def _do_prompt(self, now):
        if is_buddy(self.duck["personality"]):
            self._say([fill(self._picker.pick(buddy_key(self.duck)), self.duck, "")], now=now)
        else:
            self._say([PROMPT], action="Paste code", now=now)

    def on_menu(self):
        self._touch(self._clock())

    # ── Paste box ────────────────────────────────────────────────────────────

    def ask_for_paste_box(self):
        """From the bubble's button or the menu. app.py opens the box when it sees the flag."""
        if not is_buddy(self.duck["personality"]):
            self.wants_paste_box = True

    def on_paste_opened(self):
        now = self._clock()
        self.wants_paste_box = False
        self._paste_open = True
        self._close_bubble(now)
        self._touch(now)

    def on_paste_closed(self, text, language):
        now = self._clock()
        self._paste_open = False
        self._last_touch = now
        if text is None:
            return
        check = self._check
        if check is None:
            from .syntax import check_code as check
        self._pending = {"result": check(text, language), "language": language, "due": now + THINKING_MS}
        self._enter("thinking", now)

    # ── Changes from outside ─────────────────────────────────────────────────

    def set_duck(self, duck):
        self.duck = duck
        self._after_change()

    def set_scale(self, scale):
        self.scale = scale
        self._after_change()

    def set_bounds(self, bounds):
        self.bounds = tuple(bounds)
        self._sit_spot = None   # it may now be off the screen; back to the corner
        if self._target and self._mode() == "strip":
            self._target = (min(self._target[0], self._max_x()), self._ground_y())
        if self.state not in ("walking", "falling") and not self._dragging:
            self._rest()

    def _after_change(self):
        now = self._clock()
        self._close_bubble(now)
        if self.state in ("walking", "falling", "landing"):
            self._enter("idle", now)
        self.step = 0
        if not self._dragging:
            self._rest()

    def set_paused(self, flag):
        self.paused = bool(flag)
        now = self._clock()
        if self.paused and not self._dragging and self.state not in ("falling",):
            self._rest()
        if self._bubble:
            self._arm(now)   # a pause cancels the auto-close; lifting it starts it again

    def set_muted(self, flag):
        self.muted = bool(flag)
