// Writes the files the desktop duck (desktop/) shares with the page: the response
// pool, the Classic duck, and the values its Python ports are checked against.
// Run: node tools/export_desktop.mjs

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateDuck, cloneDuck, bytesToFrame, MAX_FRAMES, MAX_COLOURS, MAX_NAME, MAX_SEQ } from '../js/duck-format.js';
import { label, traitWords, isBuddy, sassLevel, behaviour } from '../js/personality.js';
import { motionOffset, frameAt } from '../js/sprite-render.js';
import { createPicker, fill, composeHunches, chatterKey, buddyKey } from '../js/response-picker.js';
import { checkCode, guessLanguage, LANGUAGE_ORDER } from '../js/syntax/index.js';
import responses from '../js/responses.js';
import { PRESETS } from '../data/presets.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CORPUS_EXTENSIONS = { java: '.java', c: ['.c', '.cpp', '.h', '.cc'], javascript: '.js', python: '.py' };

// A small seeded generator, so the same cases come out every run.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── format ───────────────────────────────────────────────────────────────────

function formatCases() {
  const frame = (value) => bytesToFrame(new Uint8Array(1024).fill(value));
  const cases = PRESETS.map((preset) => ({ name: `preset ${preset.name}`, input: cloneDuck(preset) }));
  const alter = (name, change) => {
    const input = cloneDuck(PRESETS[0]);
    const replaced = change(input);
    cases.push({ name, input: replaced === undefined ? input : replaced });
  };
  alter('not an object: array', () => []);
  alter('not an object: string', () => 'duck');
  alter('not an object: null', () => null);
  alter('version newer', (d) => { d.v = 2; });
  alter('version zero', (d) => { d.v = 0; });
  alter('version string', (d) => { d.v = '1'; });
  alter('version missing', (d) => { delete d.v; });
  alter('unknown top key', (d) => { d.extra = 1; });
  alter('unknown animation', (d) => { d.animations.dance = d.animations.idle; });
  alter('unknown animation key', (d) => { d.animations.idle.speed = 2; });
  alter('unknown personality key', (d) => { d.personality.luck = 5; });
  alter('name not a string', (d) => { d.name = 5; });
  alter('name too long', (d) => { d.name = 'x'.repeat(MAX_NAME + 1); });
  alter('name at the limit', (d) => { d.name = 'x'.repeat(MAX_NAME); });
  alter('name trimmed', (d) => { d.name = '  Quackers \n'; });
  alter('name empty', (d) => { d.name = ''; });
  alter('name only spaces', (d) => { d.name = '   '; });
  alter('name with a dollar', (d) => { d.name = '$& duck'; });
  alter('palette empty', (d) => { d.palette = []; });
  alter('palette too long', (d) => { d.palette = Array(MAX_COLOURS + 1).fill('#000000'); });
  alter('palette upper case', (d) => { d.palette[0] = '#FFFFFF'; });
  alter('palette short colour', (d) => { d.palette[0] = '#fff'; });
  alter('palette not strings', (d) => { d.palette[0] = 0; });
  alter('palette not an array', (d) => { d.palette = '#ffffff'; });
  alter('frames empty', (d) => { d.frames = []; });
  alter('frames too many', (d) => { d.frames = Array(MAX_FRAMES + 1).fill(d.frames[0]); });
  alter('frames at the limit', (d) => { d.frames = Array(MAX_FRAMES).fill(d.frames[0]); });
  alter('frame too short', (d) => { d.frames[0] = d.frames[0].slice(4); });
  alter('frame not base64', (d) => { d.frames[0] = '!!!'; });
  alter('frame uses a missing colour', (d) => { d.frames[0] = frame(d.palette.length + 1); });
  alter('frame uses the last colour', (d) => { d.frames[0] = frame(d.palette.length); });
  alter('frame not a string', (d) => { d.frames[0] = 12; });
  alter('animations an array', (d) => { d.animations = []; });
  alter('animation missing', (d) => { delete d.animations.sleep; });
  alter('seq empty', (d) => { d.animations.idle.seq = []; });
  alter('seq too long', (d) => { d.animations.idle.seq = Array(MAX_SEQ + 1).fill(0); });
  alter('seq at the limit', (d) => { d.animations.idle.seq = Array(MAX_SEQ).fill(0); });
  alter('seq past the last frame', (d) => { d.animations.idle.seq = [d.frames.length]; });
  alter('seq not whole', (d) => { d.animations.idle.seq = [0.5]; });
  alter('seq negative', (d) => { d.animations.idle.seq = [-1]; });
  alter('fps zero', (d) => { d.animations.idle.fps = 0; });
  alter('fps thirteen', (d) => { d.animations.idle.fps = 13; });
  alter('fps missing', (d) => { delete d.animations.idle.fps; });
  alter('motion unknown', (d) => { d.animations.idle.motion = 'spin'; });
  alter('carried missing: copy of idle', (d) => { delete d.animations.carried; });
  alter('landing missing: copy of idle', (d) => { delete d.animations.landing; });
  alter('carried invalid', (d) => { d.animations.carried = { seq: [99], fps: 4, motion: 'none' }; });
  alter('carried null', (d) => { d.animations.carried = null; });
  alter('personality missing a slider', (d) => { delete d.personality.sass; });
  alter('personality not a multiple of five', (d) => { d.personality.sass = 7; });
  alter('personality over 100', (d) => { d.personality.energy = 105; });
  alter('personality negative', (d) => { d.personality.energy = -5; });
  alter('personality a string', (d) => { d.personality.energy = '50'; });
  alter('personality an array', (d) => { d.personality = [50, 50, 50, 50, 50]; });
  alter('speed missing: follows energy', (d) => { delete d.personality.speed; d.personality.energy = 85; });
  alter('speed invalid', (d) => { d.personality.speed = 101; });
  alter('speed not a multiple of five', (d) => { d.personality.speed = 3; });
  alter('languages duplicate', (d) => { d.languages = ['java', 'java']; });
  alter('languages unknown', (d) => { d.languages = ['rust']; });
  alter('languages not an array', (d) => { d.languages = 'java'; });
  alter('languages out of order', (d) => { d.languages = ['python', 'java']; });
  alter('languages holding a list', (d) => { d.languages = [[]]; });
  alter('roam unknown', (d) => { d.roam = 'sky'; });
  alter('roam missing', (d) => { delete d.roam; });
  alter('roam sit', (d) => { d.roam = 'sit'; });
  alter('roam path', (d) => { d.roam = 'path'; });
  alter('key order changed', (d) => Object.fromEntries(Object.entries(d).reverse()));
  return cases.map((c) => ({ ...c, result: validateDuck(c.input) }));
}

// ── personality ──────────────────────────────────────────────────────────────

function personalityCases() {
  const values = [0, 30, 35, 65, 70, 100];
  const list = [];
  for (const sass of values) for (const energy of values) for (const helpfulness of values) for (const chattiness of values) {
    list.push({ sass, energy, helpfulness, chattiness, codeFocus: 50 });
  }
  const rng = seeded(20261012);
  const step = () => Math.floor(rng() * 21) * 5;
  for (let i = 0; i < 300; i += 1) {
    const p = { sass: step(), energy: step(), helpfulness: step(), chattiness: step(), codeFocus: [0, 100, step()][i % 3] };
    if (i % 4 !== 0) p.speed = step();
    list.push(p);
  }
  return list.map((p) => ({
    p, label: label(p), traitWords: traitWords(p), isBuddy: isBuddy(p), sassLevel: sassLevel(p), behaviour: behaviour(p),
  }));
}

// ── motion ───────────────────────────────────────────────────────────────────

function motionCases() {
  const offsets = [];
  const frames = [];
  for (const motion of ['none', 'bob', 'hop', 'shake']) {
    for (let step = 0; step <= 16; step += 1) {
      offsets.push({ motion, step, result: motionOffset(motion, step) });
      for (const seq of [[3], [5, 1], [0, 1, 2, 3, 4, 5, 6, 7]]) {
        for (const still of [false, true]) {
          const animation = { seq, fps: 6, motion };
          frames.push({ animation, step, still, result: frameAt(animation, step, still) });
        }
      }
    }
  }
  return { offsets, frames };
}

// ── syntax ───────────────────────────────────────────────────────────────────

const VARIANTS = {
  plain: (text) => text,
  crlf: (text) => text.replace(/\r?\n/g, '\r\n'),
  nonascii: (text, language) => `${language === 'python' ? '#' : '//'} café 鴨 \u{1f986}\n${text}`,
};

export function corpusFiles() {
  const out = [];
  for (const language of LANGUAGE_ORDER) {
    for (const group of ['valid', 'broken']) {
      const dir = join(ROOT, 'tests', 'corpus', language, group);
      const extensions = [].concat(CORPUS_EXTENSIONS[language]);
      for (const name of readdirSync(dir).sort()) {
        if (extensions.some((e) => name.endsWith(e))) out.push({ language, group, path: `tests/corpus/${language}/${group}/${name}` });
      }
    }
  }
  return out;
}

const HAND_WRITTEN = [
  'éif (x = 1) {}',
  'if\u001f(x = 1) {}',
  'if﻿(x = 1) {}',
  '\u001c',
  '﻿',
  'a = 2\rif (x = 1) {}',
  'a = 2 if (x = 1) {}',
  'def f():\r    return 1\r',
  '\u{1f986} = [1, 2\nprint("x")\n',
  'int n = 1\nint m = 2;\n',
  'x = "café"\nif (x = 1) { }\n',
  '\tint a = 1;\n \tint b = 2\n',
  'const s = `a${b}c`\nconst t = 1;\n',
  'export default\n[1, 2]\n',
  'while (go) {\n  break\n  (x)\n}\n',
  'for (const x of xs) {\n  continue\n  [x]\n}\n',
  'const a = [1, 2]\nconst b = a.length\n(function () { return b })()\n',
];

function allFour(text) {
  const results = {};
  for (const language of LANGUAGE_ORDER) results[language] = checkCode(text, language, { useParser: false });
  return results;
}

function syntaxCases() {
  const files = [];
  const guesses = [];
  const pairs = [];
  LANGUAGE_ORDER.forEach((a, i) => LANGUAGE_ORDER.slice(i + 1).forEach((b) => pairs.push([a, b])));
  for (const file of corpusFiles()) {
    const source = readFileSync(join(ROOT, file.path), 'utf8');
    for (const [variant, make] of Object.entries(VARIANTS)) {
      const text = make(source, file.language);
      files.push({ path: file.path, language: file.language, group: file.group, variant, results: allFour(text) });
      if (variant !== 'nonascii') {
        for (const offered of [LANGUAGE_ORDER, ...pairs]) {
          guesses.push({ path: file.path, variant, offered, guess: guessLanguage(text, offered) });
        }
      }
    }
  }
  const texts = HAND_WRITTEN.map((text) => ({ text, results: allFour(text) }));
  const limits = [
    { build: ['repeat', '', 0] },
    { build: ['repeat', ' \n\t', 5] },
    { build: ['repeat', 'a', 20000] },
    { build: ['repeat', 'a', 20001] },
    { build: ['repeat', '\u{1f986}', 10000] },
    { build: ['repeat', '\u{1f986}', 10001] },
  ].map((c) => ({ ...c, results: allFour(c.build[1].repeat(c.build[2])) }));
  return { files, texts, guesses, limits };
}

// ── speech ───────────────────────────────────────────────────────────────────

function speechCases() {
  const rng = seeded(4242);
  const pickOf = (list) => list[Math.floor(rng() * list.length)];
  const step = () => Math.floor(rng() * 21) * 5;
  const kinds = ['string', 'comment', 'bracket', 'parse', 'semicolon', 'assign', 'indent'];
  const cases = [];
  for (let i = 0; i < 200; i += 1) {
    // Only the name and the sliders affect what is said, so only those are kept.
    const duck = { name: pickOf(['Edgar', '', '$& Ducksworth', 'Sir Quacks-a-Lot', '鴨']) };
    duck.personality = { sass: step(), energy: step(), helpfulness: step(), chattiness: step(), codeFocus: step(), speed: step() };
    let result;
    const shape = i % 8;
    if (shape === 0) result = { status: 'empty', findings: [], unsure: false };
    else if (shape === 1) result = { status: 'too-long', findings: [], unsure: false };
    else if (shape === 2) result = { status: 'ok', findings: [], unsure: false };
    else if (shape === 3) result = { status: 'ok', findings: [], unsure: true };
    else {
      const count = shape === 4 ? 1 : 1 + Math.floor(rng() * 5);
      const findings = Array.from({ length: count }, () => {
        const kind = i < kinds.length * 8 ? kinds[Math.floor(i / 8) % kinds.length] : pickOf(kinds);
        return { rule: 'R0', kind, line: kind === 'parse' && rng() < 0.5 ? null : 1 + Math.floor(rng() * 300) };
      });
      result = { status: 'ok', findings, unsure: rng() < 0.2 };
    }
    const randoms = Array.from({ length: 80 }, () => rng());
    let used = 0;
    const picker = createPicker(responses, () => randoms[used++]);
    const lines = composeHunches(result, duck, picker);
    // A second and third call on the same picker exercise the no-repeat rule.
    const again = [composeHunches(result, duck, picker), composeHunches(result, duck, picker)];
    cases.push({
      duck, result, randoms, lines, again,
      chatterKeys: [chatterKey(duck, false), chatterKey(duck, true)],
      buddyKey: buddyKey(duck),
      fill: fill('{name} says line {line}, {name}.', duck, i),
    });
  }
  return cases;
}

// ── output ───────────────────────────────────────────────────────────────────

export function build() {
  const parity = {
    note: 'Generated by tools/export_desktop.mjs from the JavaScript implementation. Do not edit.',
    format: formatCases(),
    personality: personalityCases(),
    motion: motionCases(),
    syntax: syntaxCases(),
    speech: speechCases(),
  };
  return {
    'desktop/buildaduck/data/responses.json': `${JSON.stringify(responses, null, 1)}\n`,
    'desktop/buildaduck/data/classic.duck.json': `${JSON.stringify(validateDuck(PRESETS[0]).duck)}\n`,
    'desktop/tests/parity.json': `${JSON.stringify(parity)}\n`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [path, content] of Object.entries(build())) {
    const full = join(ROOT, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    console.log(`wrote ${path} (${content.length} characters)`);
  }
}
