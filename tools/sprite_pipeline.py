# sprite_pipeline.py
# Authoring-time converter: tools/source/*.png -> data/presets.js
# Adapted from campus_school/sprite_tools_new.py (background detection, mask,
# flood-fill labelling). The site never runs this.

from __future__ import annotations
import base64
import colorsys
import json
import os
import sys
from collections import Counter, deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SOURCE = os.path.join(HERE, "source", "ducks.png")
# Later sheets, in the order their poses become frames 8 onwards:
# (file, poses on the sheet, source pixels per art pixel,
#  [(pose in reading order, name, may add palette colours)])
EXTRA_SHEETS = [
    # The four-frame walk cycle.
    ("walk2.png", 4, (7.5, 9.2),
     [(0, "walk 1", False), (1, "walk 2", False), (2, "walk 3", False), (3, "walk 4", False)]),
    # A sheet of 32 small poses; two reactions are used.
    ("ducks2.png", 32, (2.8, 3.8),
     [(21, "carried", False), (29, "landing", True)]),
]
OUT_JS = os.path.join(ROOT, "data", "presets.js")
OUT_DIR = os.path.join(HERE, "out")
OUT_SHEET = os.path.join(OUT_DIR, "contact_sheet.png")
OUT_ICON = os.path.join(ROOT, "assets", "favicon.png")

SIZE = 32
EXPECTED_POSES = 8
BG_TOLERANCE = 60          # the sheet's magenta is noisy; 10 leaves 82 specks
MIN_COMPONENT = 200
PITCH_RANGE = (5.5, 7.5)   # source pixels per art pixel
MERGE_DISTANCE = 48        # RGB distance under which two cell colours are one
OUTLINE_LUMA = 60          # colours darker than this are outline
BODY_HUE = (42, 70)        # HSV hue range, degrees
BODY_MIN_SAT = 0.4
STAGE_COLOUR = (0x9F, 0xD3, 0xE6)

FRAME_NAMES = ["standing", "walking", "squeaking", "asleep",
               "blink", "thinking", "happy", "front"]

RECOLOURS = {
    "Midnight": ("#4a4a5e", "#23232e"),
    "Bubblegum": ("#ff9ecb", "#d9588f"),
    "Ghost": ("#ffffff", "#c9cfe0"),
}

ANIMATIONS = {
    "idle": {"seq": [5, 5, 5, 4], "fps": 2, "motion": "none"},
    "walk": {"seq": [8, 9, 10, 11], "fps": 8, "motion": "bob"},
    "squeak": {"seq": [2, 0], "fps": 6, "motion": "hop"},
    "sleep": {"seq": [3], "fps": 1, "motion": "bob"},
    "thinking": {"seq": [5], "fps": 4, "motion": "shake"},
    "carried": {"seq": [12], "fps": 4, "motion": "shake"},
    "landing": {"seq": [13], "fps": 4, "motion": "none"},
}


def fail(message: str):
    print(f"[PIPELINE ERROR] {message}")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Background
# ─────────────────────────────────────────────────────────────────────────────

def detect_background(rgb: np.ndarray) -> np.ndarray:
    return rgb[0, 0].astype(int)


def background_mask(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    a = rgb.astype(int)
    near = np.abs(a - bg).max(axis=-1) <= BG_TOLERANCE
    # Magenta family: catches the darker fringe pixels around each sprite.
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    fringe = (np.minimum(r, b) - g > 40) & (np.abs(r - b) < 60)
    return near | fringe


# ─────────────────────────────────────────────────────────────────────────────
# Segmentation
# ─────────────────────────────────────────────────────────────────────────────

def components(fore: np.ndarray):
    h, w = fore.shape
    labels = np.zeros((h, w), dtype=int)
    boxes = []
    label = 0
    for y in range(h):
        for x in range(w):
            if fore[y, x] and labels[y, x] == 0:
                label += 1
                queue = deque([(y, x)])
                labels[y, x] = label
                x0 = x1 = x
                y0 = y1 = y
                count = 0
                while queue:
                    cy, cx = queue.popleft()
                    count += 1
                    x0, x1 = min(x0, cx), max(x1, cx)
                    y0, y1 = min(y0, cy), max(y1, cy)
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and fore[ny, nx] and labels[ny, nx] == 0:
                            labels[ny, nx] = label
                            queue.append((ny, nx))
                if count >= MIN_COMPONENT:
                    boxes.append((x0, y0, x1 + 1, y1 + 1))
    return boxes


def reading_order(boxes):
    by_centre = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    heights = sorted(b[3] - b[1] for b in boxes)
    gap = heights[len(heights) // 2] / 2
    rows = [[by_centre[0]]]
    for prev, box in zip(by_centre, by_centre[1:]):
        if (box[1] + box[3]) / 2 - (prev[1] + prev[3]) / 2 > gap:
            rows.append([])
        rows[-1].append(box)
    return [box for row in rows for box in sorted(row, key=lambda b: b[0])]


# ─────────────────────────────────────────────────────────────────────────────
# Grid
# ─────────────────────────────────────────────────────────────────────────────

def edge_signal(rgb: np.ndarray, axis: int) -> np.ndarray:
    a = rgb.astype(int)
    diff = np.abs(np.diff(a, axis=axis)).sum(axis=-1)
    return diff.sum(axis=1 - axis).astype(float)


def best_comb(signal: np.ndarray):
    """Pitch and phase whose comb of positions collects the most edge energy."""
    best = (-1.0, 0.0, 0.0)
    n = len(signal)
    for pitch in np.arange(PITCH_RANGE[0], PITCH_RANGE[1], 0.02):
        for phase in np.arange(0, pitch, 0.25):
            pos = np.arange(phase, n - 1, pitch)
            idx = np.clip(np.round(pos).astype(int), 0, n - 1)
            score = signal[idx].mean()
            if score > best[0]:
                best = (score, pitch, phase)
    return best[1], best[2]


def grid_lines(length: int, pitch: float, phase: float):
    start = phase - pitch * np.ceil(phase / pitch)
    lines = list(np.arange(start, length + pitch, pitch))
    return [float(np.clip(v, 0, length)) for v in lines]


def sample_cells(rgb: np.ndarray, bg_mask: np.ndarray):
    """Returns a 2-D list of cell colours (r, g, b) or None for transparent."""
    px, phx = best_comb(edge_signal(rgb, axis=1))
    py, phy = best_comb(edge_signal(rgb, axis=0))
    xs = grid_lines(rgb.shape[1], px, phx + 0.5)
    ys = grid_lines(rgb.shape[0], py, phy + 0.5)
    rows = []
    for y0, y1 in zip(ys, ys[1:]):
        if y1 - y0 < 3:
            continue
        row = []
        for x0, x1 in zip(xs, xs[1:]):
            if x1 - x0 < 3:
                continue
            my, mx = (y1 - y0) * 0.2, (x1 - x0) * 0.2
            ya, yb = int(round(y0 + my)), max(int(round(y1 - my)), int(round(y0 + my)) + 1)
            xa, xb = int(round(x0 + mx)), max(int(round(x1 - mx)), int(round(x0 + mx)) + 1)
            block = rgb[ya:yb, xa:xb].reshape(-1, 3)
            block_bg = bg_mask[ya:yb, xa:xb].reshape(-1)
            if block_bg.mean() > 0.5:
                row.append(None)
            else:
                fg = block[~block_bg]
                row.append(tuple(int(v) for v in np.median(fg, axis=0)))
        rows.append(row)
    return rows, (px, py)


def trim(cells):
    keep_rows = [i for i, r in enumerate(cells) if any(c is not None for c in r)]
    cells = cells[keep_rows[0]:keep_rows[-1] + 1]
    width = len(cells[0])
    keep_cols = [x for x in range(width) if any(r[x] is not None for r in cells)]
    return [r[keep_cols[0]:keep_cols[-1] + 1] for r in cells]


# ─────────────────────────────────────────────────────────────────────────────
# Palette
# ─────────────────────────────────────────────────────────────────────────────

def build_palette(poses):
    hist = Counter(c for cells in poses for row in cells for c in row if c is not None)
    centres = []
    for colour, _ in hist.most_common():
        arr = np.array(colour)
        if not any(np.linalg.norm(arr - np.array(c)) < MERGE_DISTANCE for c in centres):
            centres.append(colour)

    def nearest(colour):
        d = [np.linalg.norm(np.array(colour) - np.array(c)) for c in centres]
        return int(np.argmin(d))

    # One refinement pass: move each centre to the median of its members.
    members = [[] for _ in centres]
    for colour, n in hist.items():
        members[nearest(colour)].extend([colour] * n)
    centres = [tuple(int(v) for v in np.median(np.array(m), axis=0)) for m in members if m]
    return centres, nearest


def luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def is_body(c):
    h, s, _ = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
    return BODY_HUE[0] <= h * 360 <= BODY_HUE[1] and s >= BODY_MIN_SAT


def is_brown(c):
    h, _, v = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
    return 20 <= h * 360 <= 55 and v < 0.6


def is_water(c):
    h, sat, _ = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
    return 180 <= h * 360 <= 260 and sat >= 0.25


def hex_of(c):
    return "#%02x%02x%02x" % tuple(c)


def rgb_of(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


# ─────────────────────────────────────────────────────────────────────────────
# Anchoring
# ─────────────────────────────────────────────────────────────────────────────

def anchor_info(indexed, body_slots, min_cells=1):
    """Belly row, feet rows below it, and belly centre column for one pose."""
    arr = np.array(indexed)
    body = np.isin(arr, list(body_slots))
    rows = np.where(body.sum(axis=1) >= min_cells)[0]  # min_cells skips a stray body-coloured cell in a foot
    belly = int(rows.max())
    feet = arr.shape[0] - 1 - belly
    band = body[max(0, belly - 7):belly + 1]
    cols = np.where(band.any(axis=0))[0]
    centre = (cols.min() + cols.max()) / 2
    return belly, feet, centre


def place(indexed, belly, centre, belly_row, centre_col):
    arr = np.array(indexed)
    canvas = np.zeros((SIZE, SIZE), dtype=np.uint8)
    top = belly_row - belly
    left = int(round(centre_col - centre))
    h, w = arr.shape
    if top < 0 or left < 0 or top + h > SIZE or left + w > SIZE:
        return None, (left, top, left + w, top + h)
    canvas[top:top + h, left:left + w] = arr
    return canvas, (left, top, left + w, top + h)


# ─────────────────────────────────────────────────────────────────────────────
# Output
# ─────────────────────────────────────────────────────────────────────────────

def recolour(palette, body_slots, light, dark):
    out = list(palette)
    ordered = sorted(body_slots, key=lambda s: -luma(palette[s - 1]))
    a, b = np.array(rgb_of(light)), np.array(rgb_of(dark))
    for i, slot in enumerate(ordered):
        t = 0 if len(ordered) == 1 else i / (len(ordered) - 1)
        out[slot - 1] = tuple(int(round(v)) for v in a + (b - a) * t)
    return out


def draw_frame(sheet, frame, palette, ox, oy, scale):
    for y in range(SIZE):
        for x in range(SIZE):
            v = frame[y, x]
            if v:
                sheet[oy + y * scale:oy + (y + 1) * scale,
                      ox + x * scale:ox + (x + 1) * scale] = palette[v - 1]


def write_contact_sheet(frames, palettes):
    scale, pad = 8, 8
    cell = SIZE * scale + pad
    sheet = np.zeros((len(palettes) * cell + pad, len(frames) * cell + pad, 3), dtype=np.uint8)
    sheet[:] = STAGE_COLOUR
    for r, palette in enumerate(palettes):
        for i, frame in enumerate(frames):
            draw_frame(sheet, frame, palette, pad + i * cell, pad + r * cell, scale)
    os.makedirs(OUT_DIR, exist_ok=True)
    Image.fromarray(sheet).save(OUT_SHEET)


def write_icon(frame, palette):
    scale = 2
    icon = np.zeros((SIZE * scale, SIZE * scale, 4), dtype=np.uint8)
    for y in range(SIZE):
        for x in range(SIZE):
            v = frame[y, x]
            if v:
                icon[y * scale:(y + 1) * scale, x * scale:(x + 1) * scale] = (*palette[v - 1], 255)
    os.makedirs(os.path.dirname(OUT_ICON), exist_ok=True)
    Image.fromarray(icon, "RGBA").save(OUT_ICON)


def main():
    rgb = np.array(Image.open(SOURCE).convert("RGB"))
    bg = detect_background(rgb)
    mask = background_mask(rgb, bg)

    boxes = components(~mask)
    if len(boxes) != EXPECTED_POSES:
        fail(f"expected {EXPECTED_POSES} poses, found {len(boxes)}")
    boxes = reading_order(boxes)

    poses = []
    for name, (x0, y0, x1, y1) in zip(FRAME_NAMES, boxes):
        pad = 4
        ya, yb = max(0, y0 - pad), min(rgb.shape[0], y1 + pad)
        xa, xb = max(0, x0 - pad), min(rgb.shape[1], x1 + pad)
        cells, pitch = sample_cells(rgb[ya:yb, xa:xb], mask[ya:yb, xa:xb])
        cells = trim(cells)
        print(f"  [GRID] {name}: pitch {pitch[0]:.2f} x {pitch[1]:.2f}, "
              f"{len(cells[0])} x {len(cells)} cells")
        poses.append(cells)

    centres, nearest = build_palette(poses)
    if len(centres) > 15:
        fail(f"{len(centres)} colours after merging; raise MERGE_DISTANCE")
    centres.sort(key=lambda c: -luma(c))
    lookup = {}

    def slot(colour):
        if colour not in lookup:
            d = [np.linalg.norm(np.array(colour) - np.array(c)) for c in centres]
            lookup[colour] = int(np.argmin(d)) + 1
        return lookup[colour]

    indexed = [[[0 if c is None else slot(c) for c in row] for row in cells] for cells in poses]
    used = Counter(v for pose in indexed for row in pose for v in row if v)
    for i, c in enumerate(centres):
        kind = "outline" if luma(c) < OUTLINE_LUMA else "body" if is_body(c) else "other"
        print(f"  [PALETTE] slot {i + 1}: {hex_of(c)} {kind}, {used[i + 1]} cells")

    body_slots = [i + 1 for i, c in enumerate(centres) if is_body(c)]
    if not body_slots:
        fail("no body colour found")

    info = [anchor_info(p, body_slots) for p in indexed]
    max_feet = max(f for _, f, _ in info)
    belly_row = SIZE - 1 - max_feet
    # One shared belly-centre column, chosen so every pose fits horizontally.
    lefts = [c for _, _, c in info]
    rights = [len(p[0]) - c for p, (_, _, c) in zip(indexed, info)]
    span = max(lefts) + max(rights)
    if span > SIZE:
        fail(f"poses need {span:.1f} columns once belly-aligned; only {SIZE} available")
    centre_col = max(lefts) + (SIZE - span) / 2

    frames = []
    for name, pose, (belly, _, centre) in zip(FRAME_NAMES, indexed, info):
        canvas, box = place(pose, belly, centre, belly_row, centre_col)
        if canvas is None:
            fail(f"{name} does not fit the {SIZE}x{SIZE} canvas: {box}")
        print(f"  [PLACE] {name}: columns {box[0]}-{box[2] - 1}, rows {box[1]}-{box[3] - 1}")
        # Margins the shake and hop motions need in the 32x32 GIF export.
        if box[0] < 1 or box[2] - 1 > 30 or box[1] < 2:
            fail(f"{name} leaves no motion margin: {box}")
        frames.append(canvas)

    # Poses from the later sheets. They use the palette and the anchor already
    # fixed above, so frames 0 to 7 do not change when they are added. A pose may
    # add colours (the splash is blue); those go after the existing slots.
    def slot_2(colour, may_add):
        d = [np.linalg.norm(np.array(colour) - np.array(c)) for c in centres]
        if may_add and is_water(colour) and min(d) > MERGE_DISTANCE:
            centres.append(colour)
            print(f"  [PALETTE] slot {len(centres)}: {hex_of(colour)} added by a later sheet")
            return len(centres)
        return int(np.argmin(d)) + 1

    global PITCH_RANGE
    brown_slots = [i + 1 for i, c in enumerate(centres) if is_brown(c) and i + 1 not in body_slots]
    shade_slot = min(body_slots, key=lambda k: luma(centres[k - 1]))
    for sheet, expected, pitch_range, used in EXTRA_SHEETS:
        rgb2 = np.array(Image.open(os.path.join(HERE, "source", sheet)).convert("RGB"))
        mask2 = background_mask(rgb2, detect_background(rgb2))
        boxes2 = [b for b in components(~mask2) if b[3] - b[1] > 40]   # drops loose specks
        if len(boxes2) != expected:
            fail(f"{sheet}: expected {expected} poses, found {len(boxes2)}")
        boxes2 = reading_order(boxes2)
        first_pitch, PITCH_RANGE = PITCH_RANGE, pitch_range
        for i, label, may_add in used:
            x0, y0, x1, y1 = boxes2[i]
            pad = 4
            ya, yb = max(0, y0 - pad), min(rgb2.shape[0], y1 + pad)
            xa, xb = max(0, x0 - pad), min(rgb2.shape[1], x1 + pad)
            cells, pitch = sample_cells(rgb2[ya:yb, xa:xb], mask2[ya:yb, xa:xb])
            pose = [[0 if c is None else slot_2(c, may_add) for c in row] for row in trim(cells)]
            belly, feet, centre = anchor_info(pose, body_slots, min_cells=6)
            # These sheets draw the wing lines in brown, which shows on a recoloured
            # duck. Above the belly, brown that is not next to the beak becomes shade.
            arr = np.array(pose)
            beak = np.isin(arr, [i + 1 for i, c in enumerate(centres) if not is_body(c) and not is_brown(c) and luma(c) >= OUTLINE_LUMA])
            near_beak = np.zeros_like(beak)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    near_beak |= np.roll(np.roll(beak, dy, axis=0), dx, axis=1)
            wing = np.isin(arr, brown_slots) & ~near_beak
            if not label.startswith("walk"):
                # No legs here: brown under the belly is the bottom outline.
                under = wing.copy()
                under[:belly + 1] = False
                arr[under] = max(range(len(centres)), key=lambda k: -luma(centres[k])) + 1
            wing[belly + 1:] = False
            arr[wing] = shade_slot
            pose = arr.tolist()
            # A stride with long legs stands on the bottom row and lifts the body a row.
            lift = max(0, feet - (SIZE - 1 - belly_row))
            canvas, box = place(pose, belly, centre, belly_row - lift, centre_col)
            if canvas is None:
                fail(f"{label} does not fit the {SIZE}x{SIZE} canvas: {box} (feet {feet})")
            print(f"  [PLACE] {label}: pitch {pitch[0]:.2f} x {pitch[1]:.2f}, "
                  f"columns {box[0]}-{box[2] - 1}, rows {box[1]}-{box[3] - 1}")
            if box[0] < 1 or box[2] - 1 > 30 or box[1] < 2:
                fail(f"{label} leaves no motion margin: {box}")
            frames.append(canvas)
        PITCH_RANGE = first_pitch

    palettes = {"Classic": centres}
    for name, (light, dark) in RECOLOURS.items():
        palettes[name] = recolour(centres, body_slots, light, dark)

    presets = []
    for name, palette in palettes.items():
        presets.append({
            "v": 1,
            "name": name,
            "palette": [hex_of(c) for c in palette],
            "frames": [base64.b64encode(f.tobytes()).decode("ascii") for f in frames],
            "animations": ANIMATIONS,
            "personality": {"sass": 50, "energy": 50, "helpfulness": 50,
                            "chattiness": 50, "codeFocus": 50},
            "languages": [],
            "roam": "strip",
        })

    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    with open(OUT_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by tools/sprite_pipeline.py. Do not edit by hand.\n")
        f.write(f"export const BELLY_ROW = {belly_row};\n")
        f.write(f"export const BODY_SLOTS = {json.dumps(body_slots)};\n")
        f.write("export const PRESETS = " + json.dumps(presets, indent=2) + ";\n")
    write_contact_sheet(frames, list(palettes.values()))
    write_icon(frames[7], centres)
    print(f"  [OK] {OUT_JS}\n  [OK] {OUT_SHEET}")


if __name__ == "__main__":
    main()
