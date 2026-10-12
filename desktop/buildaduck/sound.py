"""The squeak: the page's synthesised sound (js/audio.js), rendered to a WAV file."""

import math
import struct
import wave

RATE = 22050
DURATION = 0.18
PEAK_AT = 0.06  # the frequency peaks here
LOUD_AT = 0.02  # the gain peaks here
QUIET = 0.0001
LOUD = 0.25


def _phase(t):
    # The integral of the frequency: 900 Hz rising to 1500 Hz at 60 ms, then falling to
    # 700 Hz at 180 ms, both in straight lines.
    if t <= PEAK_AT:
        cycles = 900 * t + (600 / PEAK_AT) * t * t / 2
    else:
        u = t - PEAK_AT
        cycles = 900 * PEAK_AT + 600 * PEAK_AT / 2 + 1500 * u - (800 / (DURATION - PEAK_AT)) * u * u / 2
    return 2 * math.pi * cycles


def _gain(t):
    # Web Audio's exponential ramp: v0 * (v1 / v0) ** (fraction of the way there).
    if t <= LOUD_AT:
        return QUIET * (LOUD / QUIET) ** (t / LOUD_AT)
    return LOUD * (QUIET / LOUD) ** ((t - LOUD_AT) / (DURATION - LOUD_AT))


def squeak_samples():
    """The squeak as a list of signed 16-bit samples at 22,050 Hz, mono. Pure."""
    count = round(DURATION * RATE)
    return [round(_gain(n / RATE) * math.sin(_phase(n / RATE)) * 32767) for n in range(count)]


def write_squeak(path):
    """Returns False when the file cannot be written; the duck is then silent."""
    samples = squeak_samples()
    try:
        # Opened here, not by wave: wave complains on standard error when its own open fails.
        with open(path, "wb") as raw, wave.open(raw, "wb") as file:
            file.setnchannels(1)
            file.setsampwidth(2)
            file.setframerate(RATE)
            file.writeframes(struct.pack(f"<{len(samples)}h", *samples))
    except (OSError, wave.Error):
        return False
    return True


def play(path):
    # Sound is optional: a missing device or file must never stop the duck.
    try:
        import winsound

        winsound.PlaySound(path, winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT)
    except Exception:
        pass
