import os
import struct
import sys
import tempfile
import types
import unittest
import wave
from unittest import mock

from buildaduck.sound import play, squeak_samples, write_squeak

RATE = 22050


def frequency_near(samples, seconds, window=0.005):
    """Hz measured by counting sign changes in a window around a moment."""
    lo = round((seconds - window) * RATE)
    hi = round((seconds + window) * RATE)
    crossings = sum(1 for a, b in zip(samples[lo:hi], samples[lo + 1:hi + 1]) if (a < 0) != (b < 0))
    return crossings / 2 / ((hi - lo) / RATE)


class SqueakTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.samples = squeak_samples()

    def test_sample_count_for_180_ms(self):
        self.assertEqual(len(self.samples), 3969)

    def test_samples_are_16_bit_integers(self):
        self.assertTrue(all(type(s) is int and -32768 <= s <= 32767 for s in self.samples))

    def test_peak_is_a_quarter_of_full_scale(self):
        peak = max(abs(s) for s in self.samples)
        self.assertLessEqual(peak, round(0.25 * 32767))
        self.assertGreater(peak, 0.24 * 32767)
        # Loudest about 20 ms in.
        at = max(range(len(self.samples)), key=lambda n: abs(self.samples[n])) / RATE
        self.assertAlmostEqual(at, 0.02, delta=0.001)

    def test_silence_at_both_ends(self):
        # A gain of 0.0001 is 3.3 of 32,767.
        self.assertEqual(self.samples[0], 0)
        self.assertTrue(all(abs(s) <= 4 for s in self.samples[:5]), self.samples[:5])
        self.assertTrue(all(abs(s) <= 4 for s in self.samples[-5:]), self.samples[-5:])

    def test_frequency_rises_then_falls(self):
        # 900 Hz to 1500 Hz at 60 ms, then down to 700 Hz at 180 ms. One crossing is 50 Hz.
        self.assertAlmostEqual(frequency_near(self.samples, 0.030), 1200, delta=75)
        self.assertAlmostEqual(frequency_near(self.samples, 0.060), 1480, delta=75)
        self.assertAlmostEqual(frequency_near(self.samples, 0.150), 900, delta=75)

    def test_same_samples_every_time(self):
        self.assertEqual(squeak_samples(), self.samples)


class FileTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.folder = folder.name

    def test_write_squeak(self):
        path = os.path.join(self.folder, "squeak.wav")
        self.assertTrue(write_squeak(path))
        self.assertTrue(write_squeak(path))  # overwritten each run
        with wave.open(path, "rb") as file:
            self.assertEqual((file.getnchannels(), file.getsampwidth(), file.getframerate()), (1, 2, RATE))
            self.assertEqual(file.getnframes(), 3969)
            frames = file.readframes(3969)
        self.assertEqual(list(struct.unpack("<3969h", frames)), squeak_samples())

    def test_write_failure_is_reported_quietly(self):
        self.assertFalse(write_squeak(os.path.join(self.folder, "missing", "squeak.wav")))
        self.assertFalse(write_squeak(self.folder))


class PlayTest(unittest.TestCase):
    def fake(self, play_sound):
        return types.SimpleNamespace(PlaySound=play_sound, SND_FILENAME=0x20000, SND_ASYNC=0x1, SND_NODEFAULT=0x2)

    def test_flags(self):
        calls = []
        with mock.patch.dict(sys.modules, {"winsound": self.fake(lambda *args: calls.append(args))}):
            play("x.wav")
        self.assertEqual(calls, [("x.wav", 0x20000 | 0x1 | 0x2)])

    def test_failure_is_swallowed(self):
        def broken(*args):
            raise RuntimeError("no sound device")
        with mock.patch.dict(sys.modules, {"winsound": self.fake(broken)}):
            self.assertIsNone(play("x.wav"))

    def test_missing_winsound_is_swallowed(self):
        with mock.patch.dict(sys.modules, {"winsound": None}):
            self.assertIsNone(play("x.wav"))

    @unittest.skipUnless(sys.platform == "win32", "winsound is Windows-only")
    def test_real_flag_values(self):
        import winsound
        self.assertEqual(winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT, 0x20003)


if __name__ == "__main__":
    unittest.main()
