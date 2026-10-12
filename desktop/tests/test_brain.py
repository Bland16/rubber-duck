"""The duck's behaviour, driven with a fake clock and fixed random numbers."""
import copy
import json
import os
import unittest

from buildaduck.brain import DuckBrain

# The spec's numbers, written out here so a changed constant in brain.py fails a test.
ART_SIDE = 36
FALL_SPEED = 900
LANDING_MS = 700
NAP_MS = 60000
THINKING_MS = 800
PROMPT = "You look like you're stuck, paste your code for a check"
from buildaduck.personality import behaviour

DATA = os.path.join(os.path.dirname(__file__), "..", "buildaduck", "data")
with open(os.path.join(DATA, "responses.json"), encoding="utf-8") as handle:
    POOL = json.load(handle)
with open(os.path.join(DATA, "classic.duck.json"), encoding="utf-8") as handle:
    CLASSIC = json.load(handle)

BOUNDS = (0, 0, 1000, 800)
TICK = 20


class Rig:
    """A brain with a clock the test moves and random numbers the test chooses."""

    def __init__(self, roam="strip", scale=3, randoms=None, check=None, **sliders):
        self.now = 0
        self.randoms = list(randoms or [])
        duck = copy.deepcopy(CLASSIC)
        duck["roam"] = roam
        duck["personality"].update({"chattiness": 0}, **sliders)   # quiet unless a test asks
        self.brain = DuckBrain(duck, POOL, BOUNDS, scale, lambda: self.now, self.rng, check=check)

    def rng(self):
        return self.randoms.pop(0) if self.randoms else 0.5

    def run(self, ms, until=None):
        """Ticks for ms, or until the condition holds. Returns the time that passed."""
        start = self.now
        while self.now - start < ms:
            self.now += TICK
            self.brain.tick()
            if until and until(self.brain):
                break
        return self.now - start

    def click(self):
        b = self.brain
        b.on_press(b.x + 10, b.y + 10)
        b.on_release(b.x + 10, b.y + 10)

    def drag_to(self, x, y):
        b = self.brain
        b.on_press(b.x + 10, b.y + 10)
        b.on_move(x + 10, y + 10)

    def release(self):
        b = self.brain
        b.on_release(b.x + 10, b.y + 10)


class Timings(unittest.TestCase):
    def test_starts_on_the_ground_near_the_left(self):
        rig = Rig()
        self.assertEqual(rig.brain.x, 40)
        self.assertEqual(rig.brain.y, 800 - ART_SIDE * 3 + 2 * 3)
        self.assertEqual(rig.brain.state, "idle")

    def test_idle_pause_before_walking(self):
        for energy in (0, 50, 100):
            rig = Rig(energy=energy, speed=50)
            took = rig.run(10000, until=lambda b: b.state == "walking")
            pause = behaviour(rig.brain.duck["personality"])["idlePauseMs"]
            self.assertTrue(pause < took <= pause + 2 * TICK, (energy, took, pause))

    def test_walk_speed_follows_the_speed_slider_and_the_size(self):
        for speed in (0, 50, 100):
            for scale in (3, 6):
                rig = Rig(speed=speed, energy=100, scale=scale, randoms=[1.0])
                rig.run(5000, until=lambda b: b.state == "walking")
                x0 = rig.brain.x
                rig.run(1000)
                expected = (20 + speed) * scale / 3
                self.assertAlmostEqual(rig.brain.x - x0, expected, delta=expected * 0.05 + 1, msg=(speed, scale))

    def test_sleeps_after_no_touch_and_wakes_by_itself(self):
        for energy in (0, 50, 100):
            rig = Rig(energy=energy)
            sleep_after = behaviour(rig.brain.duck["personality"])["sleepAfterMs"]
            took = rig.run(200000, until=lambda b: b.state == "sleeping")
            self.assertTrue(sleep_after <= took <= sleep_after + 6000, (energy, took))
            self.assertEqual(rig.brain.animation, "sleep")
            nap = rig.run(200000, until=lambda b: b.state != "sleeping")
            self.assertTrue(NAP_MS <= nap <= NAP_MS + 2 * TICK, nap)
            # After the nap it stays awake for a full spell again.
            awake = rig.run(200000, until=lambda b: b.state == "sleeping")
            self.assertTrue(awake >= sleep_after, (energy, awake))

    def test_a_touch_wakes_it(self):
        rig = Rig(energy=0)
        rig.run(200000, until=lambda b: b.state == "sleeping")
        rig.brain.on_menu()
        self.assertEqual(rig.brain.state, "idle")

    def test_chatter_interval(self):
        for chattiness in (50, 100):
            rig = Rig(chattiness=chattiness, energy=100)
            every = behaviour(rig.brain.duck["personality"])["chatterEveryMs"]
            took = rig.run(200000, until=lambda b: b.bubble is not None)
            self.assertTrue(every <= took <= every + 6000, (chattiness, took, every))
        quiet = Rig(chattiness=0, energy=100)
        quiet.run(50000)
        self.assertIsNone(quiet.brain.bubble)


class Modes(unittest.TestCase):
    def test_strip_and_path_stay_on_the_ground_inside_the_bounds(self):
        for roam in ("strip", "path"):
            rig = Rig(roam=roam, energy=100, speed=100, randoms=[0.0, 1.0, 0.3, 0.9] * 5)
            ground = rig.brain.y
            for _ in range(600):
                rig.run(100)
                self.assertEqual(rig.brain.y, ground)
                self.assertTrue(0 <= rig.brain.x <= 1000 - rig.brain.side)

    def test_page_walks_anywhere_inside_the_bounds(self):
        rig = Rig(roam="page", energy=100, speed=100, randoms=[0.0, 0.0, 1.0, 1.0, 0.5, 0.1] * 5)
        lowest = rig.brain.y
        ys = set()
        for _ in range(900):
            rig.run(100)
            self.assertTrue(0 <= rig.brain.x <= 1000 - rig.brain.side)
            self.assertTrue(0 <= rig.brain.y <= lowest)
            ys.add(round(rig.brain.y))
        self.assertGreater(len(ys), 20)

    def test_sit_reaches_the_corner_and_stays(self):
        rig = Rig(roam="sit", energy=100, speed=100)
        rig.run(60000, until=lambda b: (b.x, b.y) == (1000 - b.side - 16, 16))
        self.assertEqual((rig.brain.x, rig.brain.y), (1000 - rig.brain.side - 16, 16))
        rig.run(20000)
        self.assertEqual((rig.brain.x, rig.brain.y), (1000 - rig.brain.side - 16, 16))

    def test_a_sitting_duck_still_chatters(self):
        rig = Rig(roam="sit", energy=100, speed=100, chattiness=100)
        seen = 0
        for _ in range(60):
            rig.run(1000)
            if rig.brain.bubble:
                seen += 1
                rig.brain.on_bubble_close()
        self.assertGreaterEqual(seen, 2)


class Dragging(unittest.TestCase):
    def test_a_small_move_is_still_a_click(self):
        rig = Rig()
        b = rig.brain
        b.on_press(b.x + 10, b.y + 10)
        b.on_move(b.x + 13, b.y + 12)
        self.assertFalse(b.dragging)
        b.on_release(b.x + 13, b.y + 12)
        self.assertEqual(b.state, "squeaking")

    def test_strip_drop_falls_then_lands(self):
        for roam in ("strip", "path"):
            rig = Rig(roam=roam)
            ground = rig.brain.y
            rig.drag_to(500, 100)
            self.assertTrue(rig.brain.dragging)
            self.assertEqual(rig.brain.animation, "carried")
            self.assertEqual((rig.brain.x, rig.brain.y), (500, 100))
            rig.release()
            self.assertEqual(rig.brain.state, "falling")
            self.assertEqual(rig.brain.animation, "carried")
            took = rig.run(5000, until=lambda b: b.state == "landing")
            self.assertAlmostEqual(took, (ground - 100) / FALL_SPEED * 1000, delta=3 * TICK)
            self.assertEqual(rig.brain.y, ground)
            self.assertEqual(rig.brain.animation, "landing")
            landed = rig.run(5000, until=lambda b: b.state != "landing")
            self.assertTrue(LANDING_MS <= landed <= LANDING_MS + 2 * TICK, landed)
            self.assertIsNone(rig.brain.bubble)

    def test_fall_speed_grows_with_size(self):
        rig = Rig(scale=6)
        rig.drag_to(400, 0)
        rig.release()
        y0 = rig.brain.y
        rig.run(200)
        self.assertAlmostEqual(rig.brain.y - y0, FALL_SPEED * 2 * 0.2, delta=40)

    def test_page_and_sit_land_where_dropped(self):
        for roam in ("page", "sit"):
            rig = Rig(roam=roam)
            rig.drag_to(300, 200)
            rig.release()
            self.assertEqual(rig.brain.state, "landing")
            rig.run(LANDING_MS + 200)
            self.assertEqual((rig.brain.x, rig.brain.y), (300, 200))
        sit = Rig(roam="sit", energy=100)
        sit.drag_to(300, 200)
        sit.release()
        sit.run(30000)
        self.assertEqual((sit.brain.x, sit.brain.y), (300, 200))   # its new sitting place

    def test_no_landing_when_dropped_while_busy(self):
        rig = Rig()
        ground = rig.brain.y
        rig.click()                      # squeaking, bubble open
        rig.drag_to(500, 100)
        rig.release()
        self.assertNotIn(rig.brain.state, ("falling", "landing"))
        self.assertEqual(rig.brain.y, ground)
        rig.run(2000)                    # now talking
        self.assertEqual(rig.brain.state, "talking")
        rig.drag_to(200, 50)
        rig.release()
        self.assertEqual(rig.brain.state, "talking")
        self.assertEqual(rig.brain.y, ground)

    def test_a_drag_from_walking_or_sleeping_lands(self):
        walking = Rig(energy=100, randoms=[1.0])
        walking.run(5000, until=lambda b: b.state == "walking")
        walking.drag_to(500, 100)
        walking.release()
        self.assertEqual(walking.brain.state, "falling")
        sleeping = Rig(energy=0)
        sleeping.run(200000, until=lambda b: b.state == "sleeping")
        sleeping.drag_to(500, 100)
        sleeping.release()
        self.assertEqual(sleeping.brain.state, "falling")

    def test_a_grab_during_the_fall_lands_again(self):
        rig = Rig()
        rig.drag_to(500, 100)
        rig.release()
        rig.run(100)
        rig.drag_to(600, 50)
        rig.release()
        self.assertEqual(rig.brain.state, "falling")

    def test_a_click_during_the_fall_finishes_the_fall(self):
        rig = Rig()
        ground = rig.brain.y
        rig.drag_to(500, 100)
        rig.release()
        rig.run(100)
        rig.click()
        self.assertEqual(rig.brain.y, ground)
        self.assertEqual(rig.brain.state, "squeaking")

    def test_a_dragged_sitting_place_is_forgotten_when_the_screen_changes(self):
        rig = Rig(roam="sit", energy=100, speed=100)
        rig.drag_to(800, 600)
        rig.release()
        rig.run(2000)
        rig.brain.set_bounds((0, 0, 500, 400))
        rig.run(60000)
        self.assertEqual((rig.brain.x, rig.brain.y), (500 - rig.brain.side - 16, 16))

    def test_the_double_click_gap_can_be_set(self):
        rig = Rig()
        rig.brain._double_click_ms = 200
        rig.click()
        rig.now += 300
        rig.click()
        self.assertIsNone(rig.brain.bubble["action"])   # too slow: a second squeak, not the prompt

    def test_the_drag_stays_inside_the_bounds(self):
        rig = Rig()
        rig.drag_to(-500, -500)
        self.assertEqual((rig.brain.x, rig.brain.y), (0, 0))
        rig.brain.on_move(5000, 5000)
        self.assertEqual(rig.brain.x, 1000 - rig.brain.side)

    def test_a_box_opened_during_the_fall_keeps_the_duck_still_afterwards(self):
        rig = Rig(energy=100)
        rig.drag_to(500, 100)
        rig.release()
        rig.brain._say(["hello"])        # as a second click or chatter would
        rig.run(3000)
        self.assertEqual(rig.brain.state, "talking")


class Clicks(unittest.TestCase):
    def test_click_squeaks_and_speaks(self):
        rig = Rig()
        rig.click()
        self.assertTrue(rig.brain.squeak)
        self.assertEqual(rig.brain.state, "squeaking")
        self.assertEqual(rig.brain.bubble["count"], 1)
        self.assertIsNone(rig.brain.bubble["action"])
        rig.run(TICK)
        self.assertFalse(rig.brain.squeak)   # true for one tick only

    def test_muted_click_is_silent(self):
        rig = Rig()
        rig.brain.set_muted(True)
        rig.click()
        self.assertFalse(rig.brain.squeak)
        self.assertIsNotNone(rig.brain.bubble)

    def test_double_click_offers_the_paste_box_without_a_second_squeak(self):
        rig = Rig()
        rig.click()
        rig.run(TICK)
        rig.now += 150
        rig.click()
        self.assertFalse(rig.brain.squeak)
        self.assertEqual(rig.brain.bubble["text"], PROMPT)
        self.assertEqual(rig.brain.bubble["action"], "Paste code")
        before = rig.brain.bubble
        rig.now += 150
        rig.click()                      # a third click of the run does nothing
        self.assertEqual(rig.brain.bubble, before)
        rig.brain.on_bubble_action()
        self.assertTrue(rig.brain.wants_paste_box)
        self.assertIsNone(rig.brain.bubble)

    def test_two_slow_clicks_are_two_squeaks(self):
        rig = Rig()
        rig.click()
        rig.now += 2000
        rig.click()
        self.assertTrue(rig.brain.squeak)
        self.assertIsNone(rig.brain.bubble["action"])

    def test_buddy_double_click_gets_a_buddy_line(self):
        rig = Rig(codeFocus=0)
        rig.click()
        rig.now += 100
        rig.click()
        self.assertIsNone(rig.brain.bubble["action"])
        self.assertNotEqual(rig.brain.bubble["text"], PROMPT)
        rig.brain.ask_for_paste_box()
        self.assertFalse(rig.brain.wants_paste_box)


class Bubble(unittest.TestCase):
    def test_one_page_closes_itself(self):
        rig = Rig()
        rig.brain._say(["x" * 50])
        took = rig.run(60000, until=lambda b: b.bubble is None)
        self.assertTrue(7000 <= took <= 7000 + 2 * TICK, took)

    def test_only_the_last_of_several_pages_closes_itself(self):
        rig = Rig()
        rig.brain._say(["a", "b", "c"])
        rig.run(30000)
        self.assertEqual(rig.brain.bubble["index"], 0)
        self.assertTrue(rig.brain.bubble["has_next"])
        rig.brain.on_bubble_next()
        rig.brain.on_bubble_next()
        self.assertFalse(rig.brain.bubble["has_next"])
        took = rig.run(30000, until=lambda b: b.bubble is None)
        self.assertTrue(4060 <= took <= 4060 + 2 * TICK, took)

    def test_a_page_with_a_button_stays(self):
        rig = Rig()
        rig.brain._say([PROMPT], action="Paste code")
        rig.run(60000)
        self.assertIsNotNone(rig.brain.bubble)

    def test_paused_keeps_it_open_and_unpausing_starts_the_timer(self):
        rig = Rig()
        rig.brain.set_paused(True)
        rig.brain._say(["hello"])
        rig.run(30000)
        self.assertIsNotNone(rig.brain.bubble)
        rig.brain.set_paused(False)
        took = rig.run(30000, until=lambda b: b.bubble is None)
        self.assertTrue(4300 <= took <= 4300 + 2 * TICK, took)

    def test_no_chatter_while_the_bubble_or_paste_box_is_open_or_paused(self):
        rig = Rig(chattiness=100, energy=100)
        rig.brain._say([PROMPT], action="Paste code")
        rig.run(60000)
        self.assertEqual(rig.brain.bubble["text"], PROMPT)
        boxed = Rig(chattiness=100, energy=100)
        boxed.brain.on_paste_opened()
        boxed.run(60000)
        self.assertIsNone(boxed.brain.bubble)
        paused = Rig(chattiness=100, energy=100)
        paused.brain.set_paused(True)
        paused.run(60000)
        self.assertIsNone(paused.brain.bubble)


class PasteBox(unittest.TestCase):
    RESULT = {"status": "ok", "findings": [{"rule": "R3", "kind": "semicolon", "line": 1}], "unsure": False}

    def test_thinks_then_answers(self):
        rig = Rig(check=lambda text, language: self.RESULT)
        rig.brain.on_paste_opened()
        rig.brain.on_paste_closed("int x = 1", "java")
        self.assertEqual(rig.brain.state, "thinking")
        took = rig.run(5000, until=lambda b: b.bubble is not None)
        self.assertTrue(THINKING_MS <= took <= THINKING_MS + 2 * TICK, took)
        self.assertEqual(rig.brain.state, "talking")

    def test_a_click_while_thinking_does_not_lose_the_answer(self):
        rig = Rig(check=lambda text, language: self.RESULT)
        rig.brain.on_paste_opened()
        rig.brain.on_paste_closed("int x = 1", "java")
        rig.now += 200
        rig.click()                      # squeaks, with a chatter line in the bubble
        chatter = rig.brain.bubble["text"]
        rig.run(THINKING_MS + 200)
        self.assertIsNotNone(rig.brain.bubble)
        self.assertNotEqual(rig.brain.bubble["text"], chatter)
        self.assertIn("1", rig.brain.bubble["text"])   # the semicolon hunch for line 1

    def test_cancel_does_nothing(self):
        rig = Rig(check=lambda text, language: self.RESULT)
        rig.brain.on_paste_opened()
        rig.brain.on_paste_closed(None, "java")
        self.assertEqual(rig.brain.state, "idle")

    def test_the_answer_waits_while_the_box_is_open_again(self):
        rig = Rig(check=lambda text, language: self.RESULT)
        rig.brain.on_paste_opened()
        rig.brain.on_paste_closed("int x = 1", "java")
        rig.brain.on_paste_opened()
        rig.run(5000)
        self.assertIsNone(rig.brain.bubble)
        rig.brain.on_paste_closed(None, "java")
        rig.run(200)
        self.assertIsNotNone(rig.brain.bubble)

    def test_the_fixed_sentences_are_added(self):
        clean = {"status": "ok", "findings": [], "unsure": False}
        rig = Rig(check=lambda text, language: clean)
        rig.brain.on_paste_opened()
        rig.brain.on_paste_closed("let a = 1", "javascript")
        rig.run(2000, until=lambda b: b.bubble is not None)
        self.assertTrue(rig.brain.bubble["text"].endswith(" I can only check JavaScript lightly here."))
        parse = {"status": "ok", "findings": [{"rule": "P6", "kind": "parse", "line": 7}], "unsure": False}
        rig = Rig(check=lambda text, language: parse)
        rig.brain.on_paste_opened()
        rig.brain.on_paste_closed("x = (", "python")
        rig.run(2000, until=lambda b: b.bubble is not None)
        self.assertTrue(rig.brain.bubble["text"].endswith(" Python points at line 7."))


class Changes(unittest.TestCase):
    def test_pause_stops_walking_and_sends_the_duck_to_rest(self):
        rig = Rig(roam="page", energy=100, randoms=[0.9, 0.1])
        rig.run(5000, until=lambda b: b.state == "walking")
        rig.run(500)
        rig.brain.set_paused(True)
        rig.run(100)
        self.assertEqual(rig.brain.state, "idle")
        x = rig.brain.x
        rig.run(20000)
        self.assertEqual(rig.brain.x, x)
        sit = Rig(roam="sit")
        sit.brain.set_paused(True)
        self.assertEqual((sit.brain.x, sit.brain.y), (1000 - sit.brain.side - 16, 16))

    def test_a_new_size_keeps_the_duck_inside_and_closes_the_bubble(self):
        rig = Rig(randoms=[1.0], energy=100, speed=100)
        rig.run(20000, until=lambda b: b.x > 800)
        rig.brain._say(["hello"])
        rig.brain.set_scale(8)
        self.assertIsNone(rig.brain.bubble)
        self.assertLessEqual(rig.brain.x, 1000 - rig.brain.side)
        self.assertEqual(rig.brain.y, 800 - rig.brain.side + 16)

    def test_new_bounds_move_the_ground(self):
        rig = Rig()
        rig.brain.set_bounds((0, 0, 1000, 700))
        self.assertEqual(rig.brain.y, 700 - rig.brain.side + 6)

    def test_a_new_duck_takes_over(self):
        rig = Rig()
        other = copy.deepcopy(CLASSIC)
        other["name"] = "Other"
        other["roam"] = "sit"
        rig.brain.set_duck(other)
        self.assertEqual(rig.brain.duck["name"], "Other")
        self.assertEqual(rig.brain.state, "idle")


if __name__ == "__main__":
    unittest.main()
