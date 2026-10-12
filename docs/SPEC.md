# Build-a-Duck: v1 spec

Status: approved by the user on 2026-10-08 (revision 3). Revision 4 records small changes made
during the build; each is listed in section 21. Date: 2026-10-08.

## 1. Purpose

Build-a-Duck is a single web page where a visitor makes a pixel-art rubber duck, gives it a
personality, and watches it walk along the bottom of the page. Coders can paste code into the
duck and get rubber-duck-debugging "hunches" from a syntax check that runs entirely in the
browser. The page is shared from a LinkedIn post by link. Audience: coders, and people who
just want a buddy.

## 2. Scope

In scope for v1:

- pixel editor for a 32x32 duck with seven animations
- four preset ducks to start from
- five personality sliders and a walking speed slider, derived trait words, a personality label, language choice
- the living duck: walking, squeak, speech box, paste-code flow
- heuristic syntax check for Java, JavaScript, Python, C/C++
- export: sprite sheet PNG, animated GIF, `.duck.json`, share link, share card PNG
- import of a `.duck.json` file
- autosave in the browser
- a view-only mode for phone-width screens
- static link-preview image and meta tags
- deployment to GitHub Pages, a drafted LinkedIn post, and a short MP4 demo

Out of scope for v1 (decided, not forgotten):

- accounts, a gallery, any backend or server-side storage
- any network API or LLM
- a VS Code extension, desktop pet or browser extension (the duck file is designed so one could
  load it later; nothing is built for them now)
- sound packs beyond one squeak
- the maker at phone width
- per-duck link previews (they would need a backend)
- languages other than the four listed
- real compilation or semantic analysis of pasted code
- the Web Share API (sharing is by downloaded card and copied link only)

## 3. Locked decisions

| Decision | Value |
|---|---|
| Stack | Static files. Vanilla JavaScript as ES modules, HTML canvas, CSS. No framework, no bundler, no build step. |
| Runtime dependencies | None. No third-party scripts or fonts, and no network request other than the page's own files. |
| Dev tooling | Node 20 built-in test runner. Python 3 with Pillow and numpy for the art pipeline. Playwright (an npm devDependency, with `node_modules/` git-ignored) and ffmpeg for the preview image and demo video. None of it is loaded by the site. |
| Location | `C:\Users\super\dev\rubber-duck\`, its own git repo. |
| Hosting | GitHub Pages from the root of the public repo `Bland16/rubber-duck`, at `https://bland16.github.io/rubber-duck/`. The `docs/`, `tools/` and `tests/` folders are therefore also publicly served; they contain nothing private. |
| Browsers | Current Chrome, Edge and Firefox on desktop, each tested. Safari is expected to work and is not tested (no Mac is available). |
| Modes | View-only mode (section 12) when the viewport is narrower than 640 CSS px, or when the primary pointer is coarse and the viewport is shorter than 500 CSS px (a phone held sideways). Otherwise the maker. |
| Accessibility | WCAG 2.1 AA, with the one exception in section 3.1. Keyboard-operable. Light and dark themes. |
| User check-ins | The user approves this spec, gives the go-ahead before the public deployment, and approves the final result. |

### 3.1 Accessibility exception

Below 640 CSS px the maker is replaced by view-only mode. A visitor who zooms a desktop
browser until the viewport is narrower than that (for example 400% in a 1280 px window, or
200% in a window narrower than 1280 px) loses the maker. That does not meet success criterion
1.4.10 Reflow, and in windows narrower than 1280 px it does not meet 1.4.4 Resize Text. In
windows 1280 px and wider the maker remains available at 200% zoom. The user accepted this
exception on 2026-10-08.

## 4. Files and module boundaries

```
index.html
css/tokens.css          colour, spacing, type tokens as CSS custom properties (light and dark)
css/app.css
js/main.js              wiring only: creates modules, passes the duck object between them
js/duck-format.js       schema, validation, JSON, binary packing, link encode/decode
js/startup.js           chooseStartupDuck, adopt, restore (pure)
js/store.js             the current duck and the undo history (pure)
js/sprite-render.js     draws a frame or a sheet to a canvas at an integer scale
js/editor.js            pixel editor, frame strip, animation panel
js/path-draw.js         the draw-a-path dialog and its pure helpers
js/personality.js       sliders -> trait words, label, buddy mode, behaviour numbers (pure)
js/syntax/common.js     shared scanner
js/syntax/javascript.js
js/syntax/java.js
js/syntax/c.js          C and C++
js/syntax/python.js
js/syntax/index.js      guessLanguage, checkCode
js/responses.js         the hand-written line pool (data only)
js/response-picker.js   createPicker, composeHunches (pure)
js/stage.js             the living duck, speech box, paste dialog
js/panels.js            the Personality and Export panels, link copying
js/viewer.js            view-only mode: the laptop and the duck's details
js/notice.js            the notice and confirm components
js/audio.js             synthesised squeak
js/storage.js           localStorage autosave and preferences
js/export/sheet.js      sprite sheet PNG
js/export/gif.js        GIF89a encoder (pure)
js/export/card.js       share card PNG
js/export/slug.js       file-name slug (pure)
data/presets.js         generated: preset duck data
assets/og.png           generated: link preview image
assets/favicon.png      generated: the front-view frame, by the art pipeline
tools/sprite_pipeline.py   authoring-time art conversion
tools/og.html, tools/make_og.mjs   authoring-time: renders assets/og.png
tools/serve.mjs            authoring-time: a local static server for the two tools above and below
tools/record_demo.mjs      authoring-time: records the demo video
tools/source/ducks.png     the source art
tests/*.test.js
tests/corpus/<language>/valid/*   and   tests/corpus/<language>/broken/*
docs/SPEC.md, docs/POST.md, docs/demo.mp4
README.md
package.json            "type": "module"; script "test": "node --test"; devDependency playwright
.gitignore              node_modules/, tools/out/
```

Rules:

- Modules marked pure, plus `duck-format`, `syntax/*` and `responses`, use no DOM and no
  browser-only API, so Node can import and test them. `duck-format` uses `CompressionStream`,
  which Node 20 and the supported browsers provide.
- Modules exchange only the duck object (section 5) and plain data. No module reads another
  module's DOM.
- ES modules do not load from `file://`. Local running uses `python -m http.server 8000` from
  the repo root.
- `index.html` contains a static paragraph "Build-a-Duck needs JavaScript and a current
  browser." inside the main region. `main.js` removes it on successful start.

## 5. Duck format (version 1)

The same object is the `.duck.json` file and the autosave value. Share links carry a packed
binary form of it (section 5.3).

```json
{
  "v": 1,
  "name": "Quackers",
  "palette": ["#f2d50d", "#000000"],
  "frames": ["<base64>"],
  "animations": {
    "idle":     { "seq": [0, 0, 0, 1], "fps": 2,  "motion": "none"  },
    "walk":     { "seq": [6, 7, 8, 9], "fps": 10, "motion": "bob"   },
    "squeak":   { "seq": [4, 0],       "fps": 6,  "motion": "hop"   },
    "sleep":    { "seq": [5],          "fps": 1,  "motion": "bob"   },
    "thinking": { "seq": [2],          "fps": 4,  "motion": "shake" },
    "carried":  { "seq": [10],         "fps": 4,  "motion": "shake" },
    "landing":  { "seq": [11],         "fps": 4,  "motion": "none"  }
  },
  "personality": { "sass": 50, "energy": 50, "helpfulness": 50, "chattiness": 50, "codeFocus": 50 },
  "languages": ["javascript", "python"],
  "roam": "strip"
}
```

The animation values shown are the preset defaults.

| Field | Rule |
|---|---|
| `v` | Integer. Must equal 1. |
| `name` | String. Trimmed during validation; the trimmed value is kept. At most 24 UTF-16 code units after trimming. Empty displays as "Duck". |
| `palette` | Array of 1 to 15 strings matching `^#[0-9a-f]{6}$`. |
| `frames` | Array of 1 to 20 strings. Each is standard base64 of exactly 1024 bytes: one byte per pixel, row by row from the top left. Byte 0 is transparent. Byte n (1 to 15) is `palette[n-1]`. A byte above `palette.length` is invalid. |
| `animations` | An object with the five keys shown, plus `carried` and `landing` (optional on the way in; see section 21). Each value has exactly the keys `seq`, `fps`, `motion`. `seq`: array of 1 to 8 integers, each a valid frame index. `fps`: integer 1 to 12. `motion`: one of `none`, `bob`, `hop`, `shake`. |
| `personality` | An object with the five keys shown, plus `speed` (optional on the way in; see section 21), each an integer from 0 to 100 that is a multiple of 5. |
| `languages` | Array of 0 to 4 distinct values from `java`, `javascript`, `python`, `c`. |
| `roam` | `strip` (the duck walks along the bottom strip), `page` (it walks all over the page), `sit` (it walks to the top right corner and stays) or `path` (it walks back and forth along a path the visitor draws). |

Sprites are drawn facing right. The renderer mirrors them when the duck walks left.

### 5.1 Motions

Playback keeps a step counter that starts at 0 when an animation starts and increases by 1 at
every frame change, continuing across loops (so a one-frame sequence still alternates). On odd
counter values the frame is drawn shifted: `bob` up 1 pixel, `hop` up 2 pixels, `shake` left
1 pixel. `none` never shifts. Frame data is not changed. `sprite-render.js` exports the pure function
`motionOffset(motion, step)` returning `{ dx, dy }`.

On the stage and in previews the sprite is drawn on a canvas with 2 sprite pixels of spare
room on every side, so a shift never clips. In the GIF export the canvas is 32x32 and pixels
shifted outside it are dropped. The preset art leaves the margins needed (section 6), so
presets never lose pixels.

### 5.2 Validation

`validateDuck(value)` returns `{ ok: true, duck }` or `{ ok: false, reason }`, where `reason`
is the first failing check in this order: `not-object`, `version-newer` (`v` is an integer
above 1), `version` (any other `v`), `unknown-key` (at the top level or in a nested object),
`name`, `palette`, `frames`, `animations`, `personality`, `languages`, `roam`.

Nothing from a file or a link reaches the page without passing it. The duck's name is only
ever written with `textContent` or canvas `fillText`, never as HTML.

### 5.3 Share link

`https://bland16.github.io/rubber-duck/#d=<payload>`. The payload is the packed bytes below,
compressed with `deflate-raw`, then base64url without padding.

| Bytes | Content |
|---|---|
| 1 | format version (1) |
| 1 + n | name: UTF-8 byte length n, then the bytes |
| 1 + 3p | palette: count p, then red, green, blue per colour |
| 1 + 512f | frames: count f, then each frame as 512 bytes, two pixels per byte, first pixel in the high 4 bits |
| per animation | in the order idle, walk, squeak, sleep, thinking: sequence length, the indices (one byte each), fps, motion (0 none, 1 bob, 2 hop, 3 shake) |
| 5 | sass, energy, helpfulness, chattiness, codeFocus |
| 1 | languages bit mask: java 1, javascript 2, python 4, c 8 |
| 1 | roam: 0 strip, 1 page, 2 sit, 3 path |
| per extra animation | carried, then landing, in the same form as the five above (absent in older links) |
| 1 | speed (absent in older links) |

`encodeDuck(duck)` and `decodeDuck(payload)` are async. `decodeDuck` returns the same result
shape as `validateDuck`, with two extra reasons: `too-long` (payload over 20,000 characters, or
decompressed size over 20,000 bytes; decompression stops as soon as the limit is passed) and
`corrupt` (bad base64url, failed inflate, truncated or trailing bytes). A first byte above 1
gives `version-newer`. The unpacked object then goes through `validateDuck`.

If a generated link is longer than 8,000 characters, the export panel shows a note recommending
the `.duck.json` file instead.

### 5.4 Deleting a frame

Deleting frame k removes it, replaces every `seq` entry equal to k with 0, and decrements every
entry greater than k. The last remaining frame cannot be deleted.

## 6. Art pipeline (authoring time only)

`tools/sprite_pipeline.py` converts the sheets in `tools/source/` (`ducks.png`, `walk3.png`,
`ducks2.png`) into `data/presets.js`. It is run
by hand when the art changes. The site never runs Python.

It is adapted from `C:\RETIRED_Coding_Projects\campus_school\sprite_tools_new.py`, reusing
that script's corner-based background detection, background mask and flood-fill component
labelling. Its `sprite_to_rgb_matrix` (which stretches each sprite to fill the target) and
`build_shared_palette` (255 colours) are not reused.

This pipeline has been built and run on the real sheet as a spike, so this section describes
what it does and what it produced.

1. **Mask.** A pixel is background if it is within 60 per channel of the first corner's colour,
   or if it is in the magenta family (`min(red, blue) - green > 40` and
   `|red - blue| < 60`). The second test removes the dark magenta fringe around each sprite.
2. **Segment.** Label connected foreground components, keeping each bounding box. Discard
   components under 200 pixels. Exactly 8 must remain.
3. **Order.** Sort by the vertical centre of the bounding box. Start a new row wherever the
   gap between consecutive centres exceeds half the median component height. Within a row,
   sort by left edge.
4. **Grid, per pose.** Build an edge signal for each axis (the summed absolute colour
   difference between neighbouring columns, or rows). Search pitches from 5.5 to 7.5 source
   pixels in steps of 0.02 and phases in steps of 0.25, and keep the pitch and phase whose
   comb of positions has the highest mean edge signal. Measured: 6.28 to 6.32 across, 6.38 to
   6.40 down.
5. **Sample.** For each grid cell, look at its central 60%. If more than half of those pixels
   are background the cell is transparent; otherwise it takes the per-channel median of the
   non-background pixels.
6. **Palette.** Take the cell colours of all poses, most frequent first. A colour within RGB
   distance 48 of an existing palette colour joins it; otherwise it starts a new one. Each
   palette colour is then moved to the median of its members. More than 15 is an error.
   Measured: 10 colours.
7. **Classify.** Outline colours are those with luma below 60. Body colours are those with HSV
   hue from 42 to 70 degrees and saturation of at least 0.4. No body colour is an error.
8. **Anchor.** For each pose find the lowest row containing a body colour (the belly line) and
   the horizontal middle of the body-colour cells in the 8 rows ending at that line (the belly
   centre). Every pose is placed on a 32x32 canvas with its belly line on row `31 - F`, where
   F is the largest number of rows any pose has below its belly line, and its belly centre on
   one shared column chosen so that the left-most and right-most poses are equally far from
   the canvas edges.
9. **Check.** It is an error, and nothing is written, if any pose has a cell outside columns 1
   to 30 or rows 2 to 31 (the margins the `shake` and `hop` motions need in the GIF export).
   Measured: the poses occupy columns 1 to 30 and rows 2 to 31, so the check passes.
10. **Write** `data/presets.js` and `tools/out/contact_sheet.png` (every frame of every preset
    at 8x on the stage colour). `tools/out/` is git-ignored.

`data/presets.js` exports `PRESETS` (four duck objects), `BODY_SLOTS` (the palette slot numbers
classified as body) and `BELLY_ROW`.

Frame order: 0 neutral, 1 blink, 2 thinking, 3 happy, 4 squeak, 5 asleep, 6 to 9 the walk
cycle, 10 carried, 11 landing, 12 front view. Every frame except the front view shares one
body; see "One body for every pose" in section 21. Frames 3 and 12 are not used by a default
animation.

### Presets

Four ducks with identical frames and animations, differing in name and palette: Classic (the
source colours), Midnight, Bubblegum, Ghost. For the three recolours the body slots, ordered
light to dark, are replaced by the same number of shades spread evenly between two end
colours: Midnight `#4a4a5e` to `#23232e`, Bubblegum `#ff9ecb` to `#d9588f`, Ghost `#ffffff` to
`#c9cfe0`. Other slots are unchanged. Classic is the default duck. Presets have the default
personality (all sliders 50), no languages, and `roam` `strip`.

### Acceptance of the art

The builder looks at the contact sheet and accepts the art only if, in every frame, the
outline is unbroken, an eye and a beak are present, there are no cells detached from the duck,
and nothing of the background colour remains. Stray cells may be repaired by a short list of
explicit per-frame cell corrections in the script. The contact sheet is shown to the user in
the final report.

If a future sheet cannot be converted acceptably, the fallback is a duck authored as text
grids in `tools/fallback_frames.txt` and converted by the same script. The user is told if the
fallback is used. It is not needed for the current art.

## 7. Page layout and views

### 7.1 Maker (640 px and above)

- **Skip control**: the first tab stop is a button "Skip to the duck", visible only while
  focused, which moves focus to the duck.
- **Header**: the title "Build-a-Duck" and the line "Make a pixel rubber duck, give it a
  personality, and let it squeak at your code."
- **Main**, at 1024 px and above in two columns: Editor on the left; Personality above Export
  on the right. From 640 to 1023 px in one column: Editor, Personality, Export.
- **Footer**: "Made by Sarah Bland", linking to the repo.
- **Stage**: a strip 120 px tall fixed to the bottom of the window, full width, with no
  background and no border: the page shows through and stays clickable. The duck lives here
  (section 10).
- **Duck controls**: a panel inside the stage at its right end holding Paste code, Mute, Pause
  motion and Theme. It is closed until the gear button in the bottom right corner
  (named "Duck controls") is pressed. Whether it is open is remembered. The duck does not walk under this panel.

The page body has bottom padding of 136 px and `scroll-padding-bottom: 136px`, so the stage
never hides content or a focused control.

Editor, Personality and Export are each a section whose heading is a button that collapses and
expands it (`aria-expanded`). All start expanded, and each one's state is remembered.

Theme follows `prefers-color-scheme` until the visitor presses Theme, after which the choice
is remembered. All colours and spacing come from `css/tokens.css`.

### 7.2 Notices and confirms

- **Notice**: one region at the top of Main. It shows one message at a time (a new one
  replaces the old), an optional action button, and a Dismiss button. It stays until
  dismissed or replaced. Informational notices use `role="status"`; errors use `role="alert"`.
- **Confirm**: a native `<dialog>` with a message, a confirming button and Cancel. Escape
  cancels.

### 7.3 "Edited"

The duck is *edited* when its frames, palette or animations differ from those of every
preset. (So a hand-drawn duck restored by autosave still counts as edited after a reload.)

## 8. Editor

- **Preset row**: four buttons, one per preset, each showing its duck. Choosing one replaces
  frames, animations and palette, after a confirm if the duck is edited. Name, personality and
  languages are kept.
- **Grid**: the current frame at 16 screen pixels per sprite pixel (512x512) at 1024 px and
  above, 12 (384x384) below, with grid lines and a checkerboard for transparent pixels.
- **Tools** (a radio group): Pencil, Eraser, Fill, Eyedropper. Pencil and Eraser paint while
  the pointer is dragged. Fill is a 4-direction flood fill. "Clear frame" makes the current
  frame fully transparent.
- **Palette**: the duck's colours as swatches, plus a transparent swatch. Selecting a swatch
  sets the drawing colour. Each colour swatch has an edit control (a native colour input);
  changing it recolours every pixel using that slot. "Add colour" appends a slot, up to 15.
- **Frame strip**: thumbnails of all frames. Selecting one makes it current. "Duplicate frame"
  appends a copy of the current frame (disabled at 16). "Delete frame" follows section 5.4.
- **Animations**: for each of the seven animations, the sequence shown as frame thumbnails with
  add-step, remove-step and a per-step frame choice; an fps number input; a motion select; and
  a looping preview. "Reset to default" sets that animation's sequence, fps and motion to the
  Classic preset's values, replacing any index that is not a current frame with 0.
- **Name**: a text input, `maxlength` 24.
- **Undo and Redo**: up to 50 steps, covering pixel edits (one pointer stroke or one keyboard
  application is one step), Fill, Clear frame, palette edits, frame duplicate and delete, and
  animation edits. `Ctrl+Z`; `Ctrl+Y` or `Ctrl+Shift+Z`. Choosing a preset or loading a file
  empties the history. Name, personality and languages are not part of it.

Keyboard: the grid is one tab stop. Arrow keys move a visible cursor cell; Space or Enter
applies the current tool at the cursor. The cursor position and what is under it are announced
through a polite live region as "Row 3, column 5, colour 2" or "Row 3, column 5, transparent".
Every other control is a native button, input or select with a visible label.

## 9. Personality

Five personality sliders and a sixth, Walking speed (section 21): native range inputs, 0 to 100 in steps of 5, each with a visible label. The trait
word is in the slider's `aria-valuetext` and in the chips below, not beside the slider.

| Slider | 0 to 30 | 35 to 65 | 70 to 100 | What it changes |
|---|---|---|---|---|
| Sass | Polite | Dry | Savage | Wording: mild below 50, spicy at 50 and above |
| Energy | Sleepy | Steady | Zoomy | How soon it walks or sleeps (section 10) |
| Helpfulness | Cryptic | Fair | Mentor | How many hunches, and how specific (section 11) |
| Chattiness | Quiet | Chatty | Never stops | How often it speaks unprompted (section 10) |
| Code focus | Casual | Curious | Obsessed | Share of chatter that is about code; exactly 0 turns on buddy mode |

**Personality label.** One of four, chosen as the nearest centre by squared distance over
(sass, energy, helpfulness, chattiness). Ties go to the earlier row.

| Label | Voice key | Voice | Centre |
|---|---|---|---|
| Senior Engineer | `senior` | deadpan | (70, 20, 70, 50) |
| Hype Duck | `hype` | encouraging | (10, 90, 80, 80) |
| Chaos Duck | `chaos` | unhelpful | (80, 80, 10, 70) |
| Goth Duck | `goth` | gloomy, world-weary | (90, 30, 50, 10) |

**Buddy mode** is a mode, not a personality. It is on exactly when Code focus is 0. In buddy
mode: the language checkboxes are disabled; the Paste code control in Duck controls is hidden;
double-click and Enter on the duck give a buddy line instead of the paste prompt; and all
chatter is general. The label still comes from the table and is shown with a "Buddy mode"
badge beside it.

**Languages.** Four checkboxes in this order: Java, JavaScript, Python, C/C++.

**Where it walks.** Four radio buttons (the two below, and `sit` and `path` from section 21), "Along the bottom" (`roam` `strip`, the default)
and "All over the page" (`roam` `page`).

The panel shows the label, the five trait words as chips, and the badge when buddy mode is on.

`personality.js` exports `traitWords(p)`, `label(p)`, `isBuddy(p)` and `behaviour(p)`, where
`behaviour` returns the numbers used in section 10: `idlePauseMs = 4000 - 30 * energy`,
`walkSpeed = 20 + speed` (px per second), `sleepAfterMs = 20000 + 400 * energy`,
`chatterEveryMs = 60000 - 500 * chattiness` or `null` when chattiness is 0, and
`codeChatterChance = codeFocus / 100`.

## 10. The living duck

The duck is a `<button>` containing a canvas, drawn at 3 screen pixels per sprite pixel, moving
left and right along the stage.

**States**: idle, walking, sleeping, squeaking, thinking, talking.

- From idle, after `idlePauseMs`, it walks to a destination at `walkSpeed`, then returns to
  idle. With `roam` `strip` the destination is a random x within its range on the stage. With
  `roam` `page` the duck is in a fixed layer above the page and the destination is a random
  point in the viewport; it moves in a straight line and faces the horizontal direction of
  travel. A page destination is only accepted if the duck's rectangle there overlaps the
  bounding rectangle of no visible button, link, input, select, textarea, canvas or label
  other than itself; after 10 rejected tries it
  goes to a strip destination instead. The duck can therefore pass over controls while
  walking but never rests on one. It stays clickable wherever it is.
- With reduced motion or Pause motion on, or in view-only mode, `roam` `page` behaves as
  `strip`.
- After `sleepAfterMs` with no pointer or keyboard input anywhere on the page, it sleeps. Any
  input wakes it to idle.
- While a speech box is open the duck is talking: it stands still and plays idle.
- **Unprompted chatter**: when the duck enters idle, and at least `chatterEveryMs` has passed
  since the last speech box closed (or since page start), and no dialog is open, it says a
  chatter line. Never when `chatterEveryMs` is `null`.
- **Chatter topic**: each chatter line, prompted or not, is code-themed with probability
  `codeChatterChance` and general otherwise.

**Click.** A single click, or Space on the focused duck, plays the squeak animation and sound
and shows a chatter line.

**Double-click.** The second click of a double-click (`event.detail === 2`) does not squeak
again. It shows the prompt, word for word, "You look like you're stuck, paste your code for a
check", with a "Paste code" button inside the speech box that opens the paste dialog. Enter on
the focused duck does the same. In buddy mode both show a buddy line instead.

**Paste code in Duck controls** opens the paste dialog directly.

**Speech box.** White fill, 4 px black outline with stepped pixel corners and a tail pointing
at the duck, monospace text, identical in both themes. It sits above the duck and is kept
inside the window. It is real DOM text, and each line is also sent to a polite live region.
It has a close button and closes on Escape. A box with no other button also closes by itself
after `4000 + 60 * characters` ms, unless Pause motion is on, in which case it stays until
closed. With several hunches it shows one at a time with "Next" and a count such as "2 of 3".
When a box containing "Paste code" or "Next" opens, focus moves to that button; when it
closes, focus returns to the duck. Other boxes do not move focus.

**Paste dialog.** A native `<dialog>`. Contents: a language select listing the duck's chosen
languages in the section 9 order (all four if none are chosen); a textarea; the notice "Syntax
check only. Runs in your browser. Your code is not sent anywhere."; and the buttons "Ask the
duck" and "Cancel". Focus moves into the dialog and returns to the duck on close. Whenever the
textarea changes, the select is set to `guessLanguage` (section 11), unless the visitor has
changed the select by hand since the dialog opened. The textarea is emptied every time the
dialog closes.

On "Ask the duck": the dialog closes, the duck plays thinking for 800 ms, then the speech box
shows the result of `composeHunches` (section 11).

**Sound.** One squeak, synthesised with WebAudio: a sine oscillator swept 900 Hz to 1500 Hz to
700 Hz over 180 ms through a gain envelope. The audio context is created on the first click or
key press. Sound is on by default. Mute is remembered. If audio cannot start, the duck behaves
the same without sound and nothing is reported.

**Reduced motion and Pause motion.** When `prefers-reduced-motion: reduce` is set, or Pause
motion is on, the duck does not walk, does not loop animations (it shows the first frame of
the state's sequence, unshifted), and says no unprompted chatter. Click, double-click and the
paste flow still work. Pause motion is remembered.

The duck's accessible name is "<name> the duck. Press Space to squeak, Enter to paste code."
and in buddy mode "<name> the duck. Press Space to squeak, Enter to chat."

## 11. Code check

Everything in this section runs in the browser. Pasted code is never stored, logged or sent.

### 11.1 Interfaces

- `guessLanguage(text, offered)` returns one of `offered`.
- `checkCode(text, language)` returns `{ status, findings, unsure }` with `status` one of
  `empty`, `too-long`, `ok`. `unsure` is a boolean set only by R3. `findings` is an ordered array of `{ rule, kind, line }`, where `line` is a
  1-based line number or `null`. It is empty unless status is `ok`.
- `createPicker(pool, rng)` returns `{ pick(key) }`. One picker is created at page start and
  lives until reload.
- `composeHunches(result, duck, picker)` returns an array of 1 to 3 strings to show in order.

### 11.2 Limits

| Input | `status` | Spoken |
|---|---|---|
| Empty or whitespace only | `empty` | one `state.<voice>.empty` line |
| More than 20,000 characters | `too-long` | one `state.<voice>.toolong` line |
| No findings, `unsure` false | `ok` | one `state.<voice>.clean` line, which says the duck only checks syntax |
| No findings, `unsure` true | `ok` | one `state.<voice>.unsure` line, which says something looks off but the duck cannot pin it down |
| Findings | `ok` | hunches (11.7) |

### 11.3 Language guess

Markers are searched in the raw text. Each language scores one point per distinct marker
found. Python: `def `, `elif `, a line starting with `import `, a line that starts with `if `,
`for `, `while ` or `class ` and ends with `:`.
Java: `public class`, `System.out`, `import java`. C/C++: `#include`, `std::`, `printf(`,
`int main`. JavaScript: `function `, `const `, `let `, `=>`, `console.`. The highest score
among `offered` wins; on a tie or all zeros, the first of `offered` is returned.

### 11.4 Scanner

`syntax/common.js` walks the text once for a language and returns the *blanked* text plus
scanner findings. Blanked text has the same length and line breaks as the input. Inside
strings, every character between the delimiters becomes a space and the delimiters are kept.
Comments, delimiters included, become spaces. It also reports, for each line, whether the line
starts inside a multi-line string.

| Language | Comments | Strings |
|---|---|---|
| Java | `//`, `/* */` | `"`, `'` with backslash escapes; `"""` text blocks (multi-line) |
| C/C++ | `//`, `/* */` | `"`, `'` with backslash escapes; raw strings `R"tag( ... )tag"` (multi-line) |
| JavaScript | `//`, `/* */` | `"`, `'` with backslash escapes; template literals (multi-line) with nested `${ }` scanned as code |
| Python | `#` | `"`, `'` with backslash escapes; `"""` and `'''` (multi-line) |

A `"` or `'` string may continue past a line end only when the line ends with a backslash.
Preprocessor lines are also skipped by R2a.
In C/C++, a *preprocessor line* is one whose first non-space character is `#`, together with
any following lines joined to it by a trailing backslash.

JavaScript regular-expression literals are blanked like strings. A `/` starts one when the
last thing before it cannot end an expression (one of `( , = : [ ! & | ? { } ; + - * % < > ~ ^`,
one of the words `return typeof case do else in of void delete throw new yield await
instanceof`, or the start of the text) and a closing `/` follows on the same line.

Known limitations, accepted: `while (int n = read())` in C++ gets an `assign` hunch; a macro
used as a statement without a semicolon, such as `EXPORT_SYMBOL(foo)`, gets a `semicolon`
hunch; JavaScript import attributes (`with { type: "json" }`) get a `parse` hunch.

### 11.5 Rules

**R1 `bracket`** (all languages). A stack over `()`, `[]`, `{}` in the blanked text. Reports
the first problem only: a closer with nothing open (at its line); a closer that does not match
the innermost open bracket (at its line); or, at the end, the innermost bracket still open (at
the opener's line).

**R2a `string`** (all). A `"` or `'` string still open at the end of its line, where the line
does not end with a backslash; or a multi-line string still open at the end of the text
(reported at its opening line). Reports the first only.

**R2b `comment`** (Java, C/C++, JavaScript). A `/*` still open at the end of the text, reported
at its opening line.

**R3 `semicolon`** (Java, C/C++). Definitions first:

- A `{` is a *data brace* if the blanked text before it on its line, trimmed, ends with `=`,
  `,`, `(`, `[`, `{`, `]` or the word `return`, or is empty while the previous non-blank
  line's trimmed text ends with `=`; or if the word `enum` appears before it on its line, or
  on the previous non-blank line when the `{` starts its own line.
- The *first word* of a line is its first identifier after skipping leading spaces and `}`.

A line of blanked code is flagged when all of these hold:

- (a) its last non-space character is a letter, digit, `_`, `)`, `]`, `"` or `'`, or it ends
  with `++` or `--`;
- (b) the depth of `()` and `[]` is 0 at its end;
- (c) its first word is not one of `if`, `else`, `for`, `while`, `do`, `switch`, `try`,
  `catch`, `finally`, `class`, `interface`, `enum`, `struct`, `union`, `namespace`, `template`;
- (d) it does not start with `@`, is not a preprocessor line, and does not start inside a
  multi-line string;
- (e) the innermost `{` enclosing it, if any, is not a data brace;
- (f) the next non-blank line does not start with `{`, `.`, `?`, `:`, `)`, `]`, `"`, one of
  `+ - * / % & | ^ < > =`, or one of the words `extends`, `implements`, `throws`;
- (g) if its last non-space character is `)`, the matching `(` is not on an earlier line
  whose first word is one of the words in (c).

Conditions (a) to (g) make a line a *candidate*. Semicolons are treated as statement
separators, so a candidate is only reported when the line also reads as one complete statement
with a new statement starting after it. A candidate is *confident* when both of these hold:

- (h) the line has the shape of a statement: it contains a bare `=` (as defined in R4)
  outside all brackets; or its first word is `return`, `break`, `continue`, `throw`, `goto`,
  `import`, `package` or `using`; or it ends with `++` or `--`; or it ends with `)` and the
  text before the matching `(` ends with an identifier (a call);
- (i) the next non-blank line starts with a letter, `_`, `}`, `@` or `#`, or there is no next
  line.

Only confident candidates become findings. If there is at least one candidate that is not
confident, `checkCode` sets `unsure: true`.

Reports every confident line.

**R4 `assign`** (all). An `=` is *bare* when it is not part of `==`, `!=`, `<=`, `>=`, `=>`,
`:=`, or a compound assignment (`+=`, `-=`, `*=`, `/=`, `%=`, `&=`, `|=`, `^=`, `<<=`, `>>=`,
`>>>=`, `**=`, `//=`, `&&=`, `||=`, `??=`).

- Java, C/C++, JavaScript: for each `if` or `while` keyword followed by `(`, the condition is
  the text up to the matching `)`. A bare `=` directly inside that pair of parentheses, not
  inside any nested `()`, `[]` or `{}`, is flagged. (So `while ((c = getchar()) != EOF)` is not
  flagged.) A `;` directly inside the parentheses discards what came before it, so the C++17
  form `if (auto it = m.find(k); it != m.end())` is not flagged. A `{` directly inside them
  means the parenthesis never closed, and nothing after it is flagged.
- Python: for each line whose first word is `if`, `elif` or `while`, the condition is the text
  from after that word to the first `:` that is outside all `()`, `[]`, `{}`. A bare `=`
  outside all brackets in the condition is flagged. (So `if foo(key=1):` is not flagged.)

Reports every flagged line once.

**R5 `indent`** (Python). Only lines that do not start inside a multi-line string and have
non-space content are considered. Flag the first line whose leading whitespace contains both a
tab and a space. If there is none: take the first indented line's style (tabs or spaces) and
flag the first indented line that uses the other.

**R6 `parse`** (JavaScript). The text is prepared and handed to the `AsyncFunction`
constructor (`Object.getPrototypeOf(async function () {}).constructor`). The function is never
called. A `SyntaxError` produces one finding with `line: null`. The engine's message is
discarded and never shown. Preparation, done on the blanked text's positions but applied to
the original text:

- an `import` statement starting a line is replaced with spaces from `import` through the
  closing quote of its module specifier (possibly several lines later);
- `export default` starting a line is replaced with `void` and spaces;
- `export` starting a line and followed by `{` or `*` is replaced with spaces through the end
  of that statement (its `;`, or the end of the line holding the closing `}` or specifier);
- any other `export` starting a line is replaced with spaces.

A first line starting with `#!` is also replaced with spaces.

R6 is *unavailable* when the text contains `import.meta` outside strings and comments, or when
constructing the function throws anything other than a `SyntaxError`.

### 11.6 Combining and ordering

For JavaScript:

- R6 passed: R1, R2a and R2b findings are discarded. R4 findings are kept.
- R6 failed and R1/R2 found something: the R1/R2 findings are kept and the `parse` finding is
  discarded. R4 findings are kept.
- R6 failed and R1/R2 found nothing: the `parse` finding is kept, with R4 findings.
- R6 unavailable: R1, R2 and R4 findings are kept as they are.

`findings` is ordered by kind (`string`, `comment`, `bracket`, `parse`, `semicolon`, `assign`,
`indent`), then by line.

### 11.7 From findings to speech (the three tiers)

`composeHunches` does this for a result with findings:

1. **Find.** Take the first N findings, where N is 1 for helpfulness 0 to 30, 2 for 35 to 65,
   3 for 70 to 100.
2. **Voice.** The personality label gives the voice key.
3. **Wording.** Sass gives `mild` (below 50) or `spicy` (50 and above). Helpfulness gives the
   detail level: `vague` (0 to 30; no line number), `line` (35 to 65; names the line), `fix`
   (70 to 100; names the line and says what to try). A finding of kind `parse`, or with
   `line: null`, always uses `vague`.

Each hunch is `picker.pick("hunch.<voice>.<kind>.<sass>.<detail>")` with `{line}` and `{name}`
substituted (`{name}` is "Duck" when the name is empty). If K findings were left out,
" (+K more)" is appended to the last hunch, so a spoken line is at most 140 characters.

Every hunch is worded as a guess ("looks like", "I think", "might be"), never as a certainty.
A Chaos Duck with high helpfulness still gets `fix` lines; they are written in its voice
(right for the wrong reasons).

### 11.8 Response pool

`js/responses.js` default-exports one object mapping a key to an array of strings. Keys:

| Key pattern | Values | Lines per key |
|---|---|---|
| `hunch.<voice>.<kind>.<sass>.<detail>` | voice: 4; kind: `string`, `comment`, `bracket`, `semicolon`, `assign`, `indent`; sass: `mild`, `spicy`; detail: `vague`, `line`, `fix` | at least 2 |
| `hunch.<voice>.parse.<sass>.vague` | voice: 4; sass: 2 | at least 2 |
| `state.<voice>.<state>` | state: `empty`, `toolong`, `clean`, `unsure` | at least 2 |
| `chatter.<voice>.<sass>.<topic>` | topic: `code`, `general` | at least 5 |
| `buddy.<voice>` | | at least 5 |

That is 152 hunch keys (304 lines or more), 16 state keys, 16 chatter keys and 4 buddy keys.
Templates may contain `{line}` and `{name}`. Every `line` and `fix` template contains
`{line}`; no `vague` template does. No line exceeds 125 characters after substitution with a
24-character name and a 5-digit line number. No profanity.

### 11.9 Picker

`pick(key)` deals from a shuffled copy of the key's lines, reshuffling only when all have been
dealt, and never returns the same line twice in a row for a key (if a reshuffle would, the
first two entries are swapped). An unknown key throws. The random source is injected.

## 12. View-only mode

Shown instead of the maker under the condition in section 3. The duck shown is the current duck, chosen by the same startup
rules as the maker (section 14). Contents:

- the title and the header line
- a pixel-art laptop drawn on a canvas by code: a dark bezel around a screen of flat colour
  `#f6f3ea`, above a keyboard base, scaled in whole multiples to fit the width. This is a live
  animation, not a video file, so that it can show the duck from a shared link.
- the duck as a `<button>` positioned over the laptop screen, walking back and forth across
  it, with the accessible name "<name> the duck. Press Space to squeak." Tapping or pressing
  Space or Enter squeaks and shows a chatter line in a speech box placed above the duck and
  kept inside the viewport. There is no paste flow.
- the duck's name, personality label, trait chips, and the buddy badge when on
- the note "Build your own on a desktop browser."
- "Copy link", which copies the current duck's share link (with the section 13 fallback)
- Mute and Pause motion

No editor, no paste flow, no export other than Copy link. Side gutters are 16 px, with no
horizontal scroll down to 320 px wide. When the condition changes (a resize or rotation) the
mode switches and keeps the current duck and its state.

## 13. Export and import

| Action | Output |
|---|---|
| Sprite sheet | PNG of all frames in one row, in frame order, transparent background, at 1x, 4x or 8x (a select, default 4x). The image is `32 * frames * scale` wide and `32 * scale` tall. File `<slug>-sheet.png`. |
| GIF | One animation (a select, default walk) at 4x or 8x (default 4x), looping forever, transparent background, frame delay `round(100 / fps)` hundredths of a second, motion applied. A one-frame sequence with a motion other than `none` is written as two frames. File `<slug>-<animation>.gif`. |
| Duck file | The duck object as JSON. File `<slug>.duck.json`. |
| Load duck file | A file input accepting `.json`. Valid: replaces the whole current duck, including name, personality and languages, after a confirm that says so if the duck is edited. Invalid, unreadable or not JSON: an error notice "That file is not a duck this version can open (<reason>)." and the current duck is unchanged. |
| Copy link | Copies the share link and shows the notice "Link copied." If the clipboard API is missing or refuses, the link is shown in a read-only text field with its text selected and the label "Press Ctrl+C to copy". |
| Share card | A 1200x627 PNG (layout below). File `<slug>-card.png`. |

`slug(name)` lower-cases the name, replaces each run of characters outside `a-z0-9` with one
`-`, trims `-` from both ends, and returns `duck` if nothing is left.

**Share card layout.** Background `#9fd3e6`. A white panel with a 6 px black outline inset
40 px from every edge. Left: the first frame of the idle sequence at 12x (384x384), centred
vertically, its left edge 96 px from the card's left edge. Right column starting at x = 560:
the name (or "Duck") in bold 64 px; the personality label in 36 px, followed by " · Buddy mode"
when on; five rows, each with the slider name, a 300x20 px bar with a black outline filled
black to the slider's percentage, and the trait word; and at the bottom
`bland16.github.io/rubber-duck` in 28 px. All text is `#111111` in the font stack
`ui-monospace, Consolas, Menlo, monospace`.

`export/gif.js` exports `encodeGif({ width, height, palette, frames, delays })`, a GIF89a
encoder written in this repo: a 16-entry global colour table with index 0 transparent, the
Netscape loop extension with count 0, a graphic control extension per frame with disposal
method 2 and transparent index 0, and LZW image data with minimum code size 4.

If an export fails, an error notice names it and the page keeps working.

## 14. Storage and load order

`localStorage` keys:

- `buildaduck.v1.duck`: the visitor's own duck as JSON, written 500 ms after the last change
- `buildaduck.v1.backup`: one previous duck (see below)
- `buildaduck.v1.prefs`: `{ muted, paused, theme, controlsOpen, sectionsCollapsed }`

Every read and write is wrapped so that a blocked or full store never breaks the page.

`chooseStartupDuck({ payloadResult, saved })` is a pure function that returns
`{ duck, mode, notice }`. `payloadResult` is the `decodeDuck` result for the `#d=` payload, or
`null` when there is none. `saved` is the validated autosaved duck or `null`.

| Case | `duck` | `mode` | `notice` |
|---|---|---|---|
| Payload valid | the link's duck | `visiting` | "You're looking at <name>. Edit it to make it yours." with the action "Back to my duck" if `saved` exists |
| Payload invalid, reason `version-newer` | `saved`, else Classic | `own` | "This duck was made with a newer version of Build-a-Duck." |
| Payload invalid, any other reason | `saved`, else Classic | `own` | "That duck link is damaged, so here is your own duck instead." |
| No payload | `saved`, else Classic | `own` | none |

`startup.js` also exports the pure functions `adopt({ duck, saved })`, returning
`{ save, backup, notice }`, and `restore({ duck, backup })`, returning `{ duck, backup }`;
`storage.js` only carries out what they return.

In `visiting` mode nothing is autosaved. The first change to anything in the duck object
*adopts* it: if `buildaduck.v1.duck` exists it is copied to `buildaduck.v1.backup`; the
fragment is removed from the address with `history.replaceState`; mode becomes `own` and
autosave starts; and if a backup was made, the notice "This duck is yours now. Your previous
duck was kept." appears with the action "Restore previous duck", which swaps the duck and the
backup.

"Back to my duck" removes the fragment and shows `saved` in `own` mode.

A `hashchange` while the page is open runs the same rules again with the new payload, after a
confirm if the current duck is edited and in `own` mode.

The page makes no network request other than loading its own static files. It sets no cookies.

## 15. Link preview and deployment

`index.html` carries `og:title` "Build-a-Duck", `og:description` "Make a pixel rubber duck,
give it a personality, and let it squeak at your code.", `og:url`
`https://bland16.github.io/rubber-duck/`, `og:image`
`https://bland16.github.io/rubber-duck/assets/og.png`, and `twitter:card`
`summary_large_image`.

`assets/og.png` is a static 1200x627 PNG under 5 MB. `tools/make_og.mjs` produces it by
opening `tools/og.html` (which draws the four preset ducks and the title on a canvas, using
the site's own renderer) in Playwright and saving a screenshot of the canvas.

Deployment creates the public GitHub repo, pushes `main`, and enables Pages from the repo
root. It makes the project public, so it happens only after the user says to go ahead. After
deployment the user checks the preview in LinkedIn's Post Inspector (it needs their sign-in)
before the first post.

## 16. LinkedIn post and demo video

- `docs/POST.md`: a drafted post under 1,300 characters, plus one alternative opening line.
- `tools/record_demo.mjs`: drives the local site in Playwright through a fixed script (choose
  a preset, recolour it, move sliders, click the duck, paste a Java snippet with a missing
  semicolon, read the hunch) and records it. ffmpeg converts the recording to `docs/demo.mp4`:
  H.264, 1280x720, 30 fps, between 10 and 29 seconds, no audio track.

## 17. Milestones

Each is demonstrated running before the next starts.

| # | Milestone | Demonstrated by |
|---|---|---|
| M0 | Syntax rules and corpus (the riskiest part) | Corpus results meeting the section 18 thresholds |
| M1 | Duck format, validation, link encoding; art pipeline and presets | Unit tests; the contact sheet looked at |
| M2 | Renderer, editor, animations | Editing and previewing in the browser |
| M3 | Personality, responses, picker, composeHunches | Unit tests; panel working in the browser |
| M4 | Stage, squeak, speech box, paste flow | A pasted broken snippet producing a hunch in the browser |
| M5 | Exports, import, share card, storage and load order | Each exported file opened and checked |
| M6 | View-only mode, themes, accessibility pass, preview image, post, video | Browser pass (section 18) |
| M7 | Deploy, after the user's go-ahead | The live URL loading; Post Inspector check by the user |

## 18. Test plan

### Unit tests (`npm test`, which runs `node --test`)

- **duck-format**: a valid duck passes; for every row of the section 5 table, at least one
  input breaking it is rejected with the right reason; the reason order (a duck with a bad
  `v` and a bad name reports the version); nested unknown keys; a name is trimmed; encode then
  decode returns a deeply equal duck for every preset and for a duck with the most frames allowed, 15
  colours and a 24-character non-ASCII name; `too-long` and `corrupt` cases including
  truncated and trailing bytes; frame deletion remaps sequences as in 5.4; the Classic share
  link is at most 4,000 characters.
- **startup**: one test per row of the section 14 table, each with and without `saved`;
  `adopt` with and without an existing saved duck; `restore` swapping duck and backup.
- **render helpers**: `motionOffset` for each motion at steps 0, 1, 2 and 3; the sheet size
  function for 1, 8 and 16 frames at each scale.
- **personality**: the label at each centre, at a tie, and at all-50; trait words at 0, 30,
  35, 65, 70, 100 for each slider; buddy mode on at code focus 0 and off at 5; `behaviour` at
  0, 50 and 100, including `chatterEveryMs` being `null` at chattiness 0.
- **scanner**: for each language, strings, comments and multi-line strings are blanked with
  length and line breaks preserved; brackets and quotes inside them do not survive; backslash
  continuation; C preprocessor lines; nested template literal expressions.
- **rules**: R1, one test per case (stray closer, mismatch, unclosed) and a balanced input.
  R2a and R2b, one failing and one passing each, per applicable language. R3, one test per
  condition (a) to (g) showing the condition suppresses a candidate; one test per shape in (h);
  a candidate failing (h) and one failing (i), each giving no finding and `unsure: true`; plus
  a plain missing-semicolon case per language. R4, per language: a bare `=`; each excluded operator; the nested
  assignment idiom; Python keyword arguments, slices after the colon, a conditional expression
  (`y = a if b else c`), and `:=`. R5: mixed within a line; mixed across lines; consistent
  tabs; consistent spaces; indentation inside a docstring ignored. R6: a syntax error;
  valid code with `import` (single and multi-line), `export default function`, `export {..}`,
  top-level `await`; `import.meta` giving unavailable.
- **combining**: the four JavaScript cases in 11.6; ordering by kind then line.
- **guessLanguage**: one clear sample per language; a tie; all zeros; `offered` restricting the
  answer.
- **checkCode limits**: empty, whitespace, 20,000 and 20,001 characters.
- **composeHunches**: N at helpfulness 0, 30, 35, 65, 70, 100; "(+K more)" present only when
  findings were left out and with the right K; the key requested for each sass and detail
  level; `parse` and null-line findings using `vague`; the `empty`, `toolong`, `clean` and
  `unsure` states; substitution of `{line}` and `{name}`.
- **responses**: every key in 11.8 exists with at least the minimum count and no other keys
  exist; the 125-character limit under worst-case substitution; `{line}` present in every
  `line` and `fix` template and absent from every `vague` one.
- **picker**: with a seeded source over 1,000 picks, no immediate repeat, and every line of a
  key is dealt before any is dealt twice; an unknown key throws.
- **gif**: output starts with `GIF89a`; logical screen size, global colour table, loop
  extension and frame count are right; each frame's LZW data decodes, using a decoder written
  in the test, to the input pixels; delays match `round(100 / fps)`.
- **slug**: mixed case, spaces, symbols, non-ASCII, empty.
- **presets**: all four pass `validateDuck`; in every frame the lowest row containing a
  `BODY_SLOTS` colour is `BELLY_ROW`;
  no frame has a pixel outside columns 1 to 30 or rows 2 to 31.

### Corpus (`tests/corpus/`)

For each of the four languages:

- **Valid**: at least 15 snippets of 10 to 60 lines. Between them they must include every
  item on that language's list:
  - Java: an enum with and without a body; a multi-line array initialiser; braces on their own
    line; a chained call split across lines; an expression split before an operator;
    annotations; `while ((line = r.readLine()) != null)`; a text block; a lambda; `public enum`;
    a wrapped `if` condition followed by an unbraced statement; adjacent string literals on
    separate lines; `class A extends B` with `implements` on the next line; strings and
    comments containing brackets, quotes and semicolons.
  - C/C++: an enum; a struct and an array initialiser; a multi-line macro; braces on their own
    line; `while ((c = getchar()) != EOF)`; a class with access labels; a template; a raw
    string; `typedef enum`; a wrapped `if` condition followed by an unbraced statement;
    `#include`, `#define` and an `#error` line containing an apostrophe; strings and comments containing brackets, quotes
    and semicolons.
  - JavaScript: code written without semicolons; template literals with nested expressions; a
    regular-expression literal containing a bracket and a quote; arrow functions; a module
    with `import` and `export`; top-level `await`; object and array literals across lines.
  - Python: keyword arguments in an `if` condition; slices; a conditional expression; a
    docstring with odd indentation; a walrus operator; a multi-line call; dict and set
    literals; strings and comments containing brackets, quotes and colons.
- **Broken**: at least 12 snippets, each a valid snippet with one seeded defect and a sidecar
  file naming the expected kind and line. Every finding kind that applies to the language
  appears in at least 2 of them.

Thresholds, per language: at most 1 valid snippet produces any finding; at least 85% of broken
snippets produce a finding of the expected kind within 1 line of the expected line (any line
for `parse`).

### Browser pass

In the running site, in Chrome, Edge and Firefox: every state in sections 7 to 14, at 1280 px,
800 px and 375 px wide, in light and dark themes; a keyboard-only run through making a duck,
pasting code and exporting; 200% zoom at 1280 px; reduced motion; no console errors; the
network panel showing no request beyond the site's own files.

### Audits

A fresh auditor reviews this spec before the build, and a fresh auditor reviews the build
against it.

## 19. Acceptance criteria

1. Opening the site at 1280 px shows the Classic duck walking on the stage with no console
   errors.
2. In the contact sheet, every frame of every preset meets the art acceptance list in
   section 6.
3. In every preset frame the belly line is on the same row (checked by the presets test).
4. A pixel drawn in the editor appears on the walking duck without a reload.
5. Recolouring a palette slot changes every pixel using it; undo restores it.
6. Frames can be duplicated and deleted, and no animation ever references a missing frame.
7. Each animation's sequence, fps and motion can be changed, previews, and resets to default.
8. Moving sliders updates the trait words and the personality label as section 9 specifies,
   and all four labels are reachable. "All over the page" makes the duck leave the strip, and
   it never comes to rest on a control.
9. Code focus at 0 hides Paste code, disables languages, shows the badge, and makes
   double-click give a buddy line; any other value restores them.
10. Clicking the duck squeaks and shows a speech box; double-clicking shows the exact prompt
    text and a Paste code button that opens the dialog.
11. Pasting Java with one missing semicolon, with helpfulness at 70 or above, yields a hunch
    naming the correct line.
12. Pasting valid code yields a "clean" line; empty and oversized pastes yield their own
    lines; code with only an unconfident semicolon candidate yields an "unsure" line.
13. The corpus thresholds are met for all four languages.
14. All unit tests pass.
15. The sprite sheet, GIF, duck file and share card download and open correctly; the GIF
    animates and loops with a transparent background; the card matches the section 13 layout.
16. A downloaded duck file loads back to an identical duck. A malformed file is refused with a
    reason and changes nothing.
17. A copied share link opened in a new window shows the same duck in visiting mode. Editing
    it clears the fragment, keeps the previous duck restorable, and survives a reload.
18. A damaged link shows the visitor's own duck (or Classic) with the damaged-link notice.
19. Reloading restores the in-progress duck and the mute, pause, theme and collapsed-controls
    preferences.
20. With reduced motion set or Pause motion on, the duck does not walk, loop or chatter
    unprompted, speech boxes stay until closed when paused, and click and paste still work.
21. Every control is reachable and operable by keyboard with a visible focus indicator and an
    accessible name; text and essential graphics meet AA contrast in both themes; at 200% zoom
    on a 1280 px window the maker is still usable.
22. Nothing is hidden behind the stage: every control can be scrolled fully into view above it.
23. At phone width the view-only mode shows the duck walking on the laptop, squeaks on tap,
    copies a link, and has no horizontal scroll at 320 px.
24. The page makes no network request beyond its own files, and pasted code is never written
    to storage.
25. `index.html` has the four Open Graph tags, and `assets/og.png` is 1200x627 and under 5 MB.
26. `docs/POST.md` and `docs/demo.mp4` exist and match section 16.

## 20. Risks

- **False positives in the semicolon rule.** It is the least reliable rule, which is why it
  only reports confident lines and otherwise says it is unsure. If the corpus thresholds
  still cannot be met with the rule as written, the build stops and the user is asked how to
  proceed. The corpus's required contents are not reduced.
- **AI-generated art that does not snap to a clean grid.** Covered by the repair and fallback
  steps in section 6.
- **Long share links.** A Classic link may be around 3,000 characters, and how LinkedIn treats
  long links in posts was not researched. The share card image plus the plain site link is the
  main way to share; the per-duck link is secondary.
- **LinkedIn's mobile in-app browser.** Its handling of audio and clipboard is undocumented.
  Both degrade without error by design, but it needs one check on a real phone after
  deployment.
- **Safari.** Not tested.

## 21. Changes made during the build

Each of these differs from revision 3 as approved.

- **Files.** `js/store.js`, `js/panels.js`, `js/viewer.js` and `tools/serve.mjs` were added, and
  the pipeline also writes `assets/favicon.png`, so the browser does not request a missing
  icon. `js/main.js` remains wiring only.
- **R3.** A line on which the scanner reported an unclosed string is not also reported as a
  missing semicolon.
- **R5.** A line that continues a bracketed expression or follows a backslash continuation is
  not judged for indentation, because Python allows any indentation there.
- **GIF.** A sequence of odd length with a motion other than `none` is written as two passes,
  so the motion alternates correctly when the GIF loops. (Revision 3 covered only the
  one-frame case.)
- **Autosave.** A pending save is also written when the page is hidden or closed.
- **Preset names.** A new duck starts with its preset's name (for example "Classic") in the
  name field.
- **Regex literals, C++17 initialisers and hashbang lines** are handled as now described in
  sections 11.4 and 11.5. These were false hunches found by the build audit.
- **Roaming.** The rest check compares whole rectangles, and counts labels as controls. The
  five-point check in revision 3 let the duck stop on small controls.
- **Focus rings.** Controls on the stage, section headings, presets and frames use a fixed
  dark ring (`#0b3d91`) in both themes, because they sit on fixed light colours. The duck has
  a dark ring with a white ring inside it, because it can be over anything.
- **Skip control** added (section 7.1), because the duck was the last of about 100 tab stops.
- **Damaged link.** A link that cannot be opened is removed from the address at startup, so
  its notice does not return on every reload.
- **Late answer.** If the paste dialog is reopened while the duck is thinking, the answer
  waits until the dialog closes.
- **View-only.** The paste dialog closes if the page drops into view-only mode, and a resize
  that does not change the laptop's scale leaves an open speech box alone.
- **Names.** A `$` in a duck's name is spoken as written.
- **Module boundaries.** `js/panels.js` hides the stage's Paste code control in buddy mode and
  imports `isEdited` from `js/editor.js`; `js/main.js` applies stored preferences to the page;
  `chooseStartupDuck` takes the fallback duck as an argument.
- **Colours outside the tokens.** The stage, speech box, share card, laptop and grid
  checkerboard use fixed colours written where they are used, because the spec fixes them in
  both themes.
- **Second build audit.** Fixed after it: focus rings on presets, frames and section headings
  are drawn inside the control; in a window shorter than 520 px the stage is 84 px tall, the
  duck is drawn at 2x and the grid shrinks to fit above the stage, so the maker stays usable
  at 200% zoom; a roaming duck that finds itself over a control after a scroll walks away;
  lifting Pause motion restarts an open speech box's timer; "Restore previous duck" is also a
  button in the Export panel while a previous duck is kept; a successful file load clears an
  earlier refusal notice; the view-only laptop is also sized to fit the window's height.
- **After the first try-out (2026-10-09).** The walk used frames 0 and 1, and frame 0 has no
  feet, so the feet flickered. The pipeline now makes a ninth frame, a second stride, and
  the walk uses 1 and 8. The trait word beside each slider was removed at the user's request;
  the chips below the sliders still show the words.
- **Also after the first try-out.** At the user's request the stage has no blue background
  (the page shows through), duck thumbnails and the laptop screen sit on a fixed cream
  (`#f6f3ea`), and the duck controls are closed behind a gear button until asked for. The
  share card and link-preview image still use `#9fd3e6`. A duck saved before the second
  stride existed is given it on load (`upgradeWalk` in `js/startup.js`).
- **Dragging and two more walking modes (2026-10-09, at the user's request).**
  - The duck can be dragged with a pointer (a move of 6 px or more is a drag, anything less
    is still a click). Dropped in `strip` mode it walks back down to the bottom; in `page`
    mode it carries on from there; in `sit` mode it stays where it was left until the window
    is resized or the page reloaded; in `path` mode it rejoins the path at the nearest point.
    Dragging is off in view-only mode. There is no keyboard way to drag; the walking modes
    are the keyboard way to move the duck.
  - `roam` gains `sit` and `path`. They are added after `strip` and `page` because a link
    stores the mode's position in that list.
  - The path is drawn on a full-window overlay opened by "Draw the path" (or by choosing the
    mode when no path exists). Escape or Cancel closes it. A line shorter than 80 px is
    refused. Points are kept at least 14 px apart, at most 400, as fractions of the window,
    in `buildaduck.v1.prefs` under `path`: the path belongs to the browser, not the duck,
    so it is not in a link or a duck file. A `path` duck with no path walks the strip. The
    duck rests for its usual idle pause at each end of the path. Drawing needs a pointer.
  - New file `js/path-draw.js`.
- **Walk cycle from the user's second sheet (2026-10-09).** The made-up second stride is
  gone. The pipeline reads four walk frames from `tools/source/ducks2.png` (art pixels of
  about 3.2 source pixels), maps them onto the palette already built from the first sheet,
  and anchors them with the same belly row, so frames 0 to 7 and the palette are unchanged.
  A stride whose legs are a row too long stands on row 31 and lifts the body one row. Brown
  wing lines in those frames become the darkest body colour so they recolour with the duck.
  Presets now have 12 frames; the default walk is 8, 9, 10, 11 at 8 fps. Frame 1 is no longer
  used by a default animation. `upgradeWalk` brings both earlier saved forms up to date.
- **Carried and landing (2026-10-09, at the user's request).**
  - Two more animations, `carried` and `landing`, after the first five. A dragged duck
    shows `carried` (frame 12, the wide-eyed pose from the second sheet, with the shake
    motion). When dropped it shows `landing` (frame 13, the splash) for 700 ms or one pass
    of the sequence, whichever is longer. In `strip` mode it first falls straight down to
    the bottom at 900 px per second, still showing `carried`. A duck dropped while talking
    or thinking does not land.
  - Format: the five original animations stay required. `carried` and `landing` are
    optional on the way in and are filled with a copy of `idle`; a validated duck always
    has all seven. In a link they are written after the roam byte, and a link that ends at
    the roam byte is still read.
  - Presets have 14 frames and 12 colours: the splash adds two blues at the end of the
    palette. Both new animations appear in the Animations panel and the GIF list.
  - `upgradeWalk` is now `upgradeDuck` and also gives a preset-built saved duck the two
    frames, the two colours and the two animations.
- **Walk cycle replaced (2026-10-09).** The user supplied a dedicated four-pose walk sheet,
  `tools/source/walk2.png`, drawn at about 8 source pixels per art pixel, which fits the
  canvas without resampling. It replaces the cycle taken from `ducks2.png`; that sheet now
  supplies only the carried and landing poses. An earlier candidate sheet was 33 by 38 art
  pixels, too large for the canvas, and was not used. `upgradeDuck` recognises the replaced
  cycle's four frames by hash and swaps them, so a walk someone has redrawn is left alone.
  The pipeline's later sheets are listed in `EXTRA_SHEETS`.
- **Six-frame walk (2026-10-09).** The user supplied a twelve-pose walk sheet,
  `tools/source/walk3.png`. Its top row is one full cycle and is now the walk: frames 8 to
  11, then 14 and 15 (after the reactions, so frames 12 and 13 keep their numbers), at
  10 fps. The bottom row is not used. `walk2.png` is no longer read. Presets now have 16
  frames, so the frame limit went from 16 to 20 to leave room to add frames. `upgradeDuck`
  swaps both earlier cycles by hash and adds the two frames to a duck still on the default
  four-step walk.
- **Back to a four-frame walk (2026-10-09, the user's choice).** The walk is the first four
  poses of `walk3.png`, frames 8 to 11, at 10 fps. Frames 14 and 15 are gone, so presets
  have 14 frames again; the frame limit stays at 20. A stray line beside the third walk
  frame, leaked from the neighbouring pose on the sheet, is removed: walk poses keep only
  their largest connected group of cells. `upgradeDuck` cleans that frame and drops the
  two extra frames from a saved duck unless an animation still uses them.
- **Walking speed slider (2026-10-10, at the user's request).** A sixth slider, "Walking
  speed", sets `personality.speed` (0 to 100 in steps of 5) and `walkSpeed = 20 + speed`.
  Energy no longer sets the speed; it still sets how soon the duck walks and sleeps. Speed
  is not a trait: it has no chip, is not on the share card and does not affect the label.
  It is optional on the way in and defaults to the duck's energy, so older ducks walk as
  they did; a validated duck always has it. In a link it is one byte after the carried and
  landing animations.
- **Third build audit (2026-10-10 to 12).** A fresh auditor checked everything since the
  second audit and found no high and five medium problems, all fixed:
  - The demo video had grown to 43 s; it is 23 s again.
  - A speech box opened while the duck was falling or landing no longer lets it walk off.
  - A duck that stays put (`sit` mode) now chatters: the chatter check also runs each time
    its idle pause ends.
  - Opening the duck controls while the duck walks towards them shortens the walk, so it does
    not stop on the panel.
  - The draw-a-path overlay is now a native modal `<dialog>`, so the page behind it cannot be
    reached. It opens only from the "Draw the path" button, never from choosing the radio
    button, and closes without saving if the window is resized.
  Lower findings fixed: no drag cursor or `touch-action: none` in view-only mode; a drag ends
  if pointer capture is lost or the page switches mode; path points are measured against the
  duck's own layer; `upgradeDuck` also runs on loaded duck files, opened links and the
  restored backup; the strict belly-row test is back; a compiled Python file is no longer in
  the repository.
- **Accepted as they are.**
  - A `sit` duck, a `path` duck at rest and a dropped duck can cover controls under them;
    dragging the duck away uncovers them. Only `page` mode avoids controls.
  - With motion off: a `sit` duck jumps to its corner; a duck dropped in `page` or `path`
    mode shows the landing and then returns to the bottom; a duck dropped while talking or
    thinking in `strip` mode returns to the bottom at once.
  - A drag wakes a sleeping duck and cancels a walk. Drawing a new path restarts from its
    first point. A resize stops a path walk and forgets a dragged `sit` spot.
  - A stored path that fails its checks is discarded without a message.
  - New wording on the page: the speed slider's spoken values Slow, Medium and Fast; the
    gear's tooltip "Duck controls"; "You can also drag the duck anywhere with the mouse.";
    "No path yet, so it walks along the bottom. Press Draw the path."; "That was too short.
    Press and drag a longer line."
- **One body for every pose (2026-10-12, at the user's request).** The source sheets were
  drawn separately, so the duck's length and head shape changed from one animation to the
  next. The pipeline now extracts the poses as before and then `unify()` redraws them on one
  body, the round one of the blink pose, changing only what should differ:
  - neutral: an open eye; thinking: a raised brow; happy and blink: as drawn
  - squeak: the beak opens; asleep: the closed eye and a small Z
  - walk 1 to 4: the legs of the four `walk3.png` poses under the shared body
  - carried: a wide eye; landing: the happy face with a splash at both sides
  - front view: unchanged
  The edits are written in the pipeline as rows of palette slots and stop the build if the
  palette changes. Presets now have 13 frames in the order given in section 6, and 12
  colours. The original standing, walking, open-beak and lying-down drawings are no longer
  in the presets. `upgradeDuck` is now one rule: a duck that still holds the old walking
  frame (recognised by hash, with a fixture in `tests/fixtures/`) is given the current
  frames and animations, and its palette is topped up to twelve colours; its name, colours,
  personality, languages and walking mode are kept, and pixels redrawn on the old frames are
  lost. A Classic share link is now about 900 characters.
