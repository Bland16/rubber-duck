# Build-a-Duck

Make a pixel rubber duck, give it a personality, and let it squeak at your code.

A single static page: vanilla JavaScript modules, HTML canvas and CSS. No framework, no build
step, no backend, and no network requests beyond the page's own files. The syntax check runs
in the browser; pasted code is never stored or sent.

The full design is in [docs/SPEC.md](docs/SPEC.md).

## Run it locally

ES modules do not load from `file://`, so serve the folder:

```
python -m http.server 8000
```

Then open http://localhost:8000/.

## Tests

```
npm test
```

Runs the unit tests and the syntax-check corpus in `tests/corpus/` with Node's built-in test
runner (Node 20 or later).

## Authoring tools

These are not part of the site.

| Command | What it does | Needs |
|---|---|---|
| `python tools/sprite_pipeline.py` | Converts the sheets in `tools/source/` into `data/presets.js`, `assets/favicon.png` and a contact sheet in `tools/out/` | Python 3 with Pillow and numpy |
| `node tools/make_og.mjs` | Renders `assets/og.png`, the link-preview image | `npm install`, then `npx playwright install chromium` |
| `node tools/record_demo.mjs` | Records `docs/demo.mp4` | the above, plus ffmpeg |

## Layout

- `index.html`, `css/`, `js/`, `data/`, `assets/`: the site
- `js/syntax/`: the heuristic syntax rules, one file per language
- `js/responses.js`: everything the duck can say
- `tests/`: unit tests and the corpus
- `tools/`: authoring-time scripts
