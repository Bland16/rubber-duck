// Cases found by the build audit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCode } from '../js/syntax/index.js';
import { scan, LANGUAGES } from '../js/syntax/common.js';
import { fill } from '../js/response-picker.js';

const kinds = (text, language) => checkCode(text, language).findings.map((f) => `${f.kind}@${f.line}`);

test('a regex literal containing = is not an assignment in a condition', () => {
  assert.deepEqual(kinds('if (/a=b/.test(s)) { go(); }\n', 'javascript'), []);
  assert.deepEqual(kinds('while (!/^k=(\\d+)$/.test(next())) { skip(); }\n', 'javascript'), []);
});

test('regex literals are blanked, and division is left alone', () => {
  const blank = (text) => scan(text, LANGUAGES.javascript).blanked;
  assert.equal(blank('const r = /[(/"]+/gi;'), 'const r =           ;');
  assert.equal(blank('const half = total / 2 / parts;'), 'const half = total / 2 / parts;');
  assert.equal(blank('const y = (a + b) / c;'), 'const y = (a + b) / c;');
  assert.equal(blank('return /x{/.test(s);'), 'return     .test(s);');
});

test('a module with a bracket in a regex has no findings, even when it cannot be parsed for real', () => {
  assert.deepEqual(kinds('const u = import.meta.url;\nconst r = /[(]"/;\nexport default r;\n', 'javascript'), []);
});

test('a C++17 if with an initialiser is not an assignment in a condition', () => {
  assert.deepEqual(kinds('int f(std::map<int, int>& m, int k) {\n  if (auto it = m.find(k); it != m.end()) { return it->second; }\n  return 0;\n}\n', 'c'), []);
  assert.deepEqual(kinds('int f(int a, int b) {\n  if (a = b) { return 1; }\n  return 0;\n}\n', 'c'), ['assign@2']);
});

test('a hashbang line is not a parse error', () => {
  assert.deepEqual(kinds('#!/usr/bin/env node\nconsole.log(1);\n', 'javascript'), []);
});

test('a $ in a duck name is spoken as written', () => {
  const duck = (name) => ({ name });
  assert.equal(fill('I am {name}, line {line}.', duck('Ca$$h'), 7), 'I am Ca$$h, line 7.');
  assert.equal(fill("{name} here.", duck("$'"), 1), "$' here.");
  assert.equal(fill('{name} and {name}', duck('$&'), 1), '$& and $&');
});

test('many unclosed conditions are checked in well under a second', () => {
  const text = 'if (a\n'.repeat(3300);
  assert.ok(text.length <= 20000);
  const inputs = { 'unclosed conditions': text, 'unclosed slashes': `=${'/['.repeat(9999)}` };
  for (const [name, input] of Object.entries(inputs)) {
    for (const language of ['javascript', 'java', 'c']) {
      // Best of three, so a busy machine does not fail the test.
      let best = Infinity;
      for (let run = 0; run < 3; run += 1) {
        const started = performance.now();
        checkCode(input, language);
        best = Math.min(best, performance.now() - started);
      }
      assert.ok(best < 250, `${name} in ${language} took ${Math.round(best)} ms`);
    }
  }
});

test('a duck built on the earlier preset frames is given the current ones', async () => {
  const { upgradeDuck } = await import('../js/startup.js');
  const { PRESETS } = await import('../data/presets.js');
  const { validateDuck, bytesToFrame } = await import('../js/duck-format.js');
  const { readFileSync } = await import('node:fs');
  // The old "walking" frame, kept as a fixture so the hash is checked against real data.
  const oldWalking = readFileSync(new URL('./fixtures/old-walking-frame.txt', import.meta.url), 'utf8').trim();
  const blank = bytesToFrame(new Uint8Array(1024));
  const stored = {
    ...structuredClone(PRESETS[2]),
    name: 'Mine',
    palette: PRESETS[2].palette.slice(0, 10),
    frames: [blank, oldWalking, blank, blank, blank, blank, blank, blank],
    roam: 'sit',
  };
  stored.animations = Object.fromEntries(['idle', 'walk', 'squeak', 'sleep', 'thinking'].map((k) => [k, { seq: [0, 1], fps: 6, motion: 'bob' }]));
  stored.personality = { ...stored.personality, sass: 95 };
  const old = validateDuck(stored).duck;
  const upgraded = upgradeDuck(old, PRESETS);
  assert.deepEqual(upgraded.frames, PRESETS[2].frames);
  assert.deepEqual(upgraded.animations, PRESETS[2].animations);
  assert.deepEqual(upgraded.palette, PRESETS[2].palette);
  assert.equal(upgraded.name, 'Mine');
  assert.equal(upgraded.roam, 'sit');
  assert.equal(upgraded.personality.sass, 95);
  assert.equal(validateDuck(upgraded).ok, true);
  // A palette someone added a colour to keeps it and is topped up to the preset's length.
  const more = { ...old, palette: [...old.palette, '#123456'] };
  assert.deepEqual(upgradeDuck(more, PRESETS).palette, [...more.palette, PRESETS[2].palette[11]]);
  assert.equal(validateDuck(upgradeDuck(more, PRESETS)).ok, true);
  // Left alone: current ducks, a duck with other art, a one-frame duck, nothing saved.
  for (const preset of PRESETS) assert.equal(upgradeDuck(preset, PRESETS), preset);
  const other = { ...old, frames: old.frames.map(() => blank) };
  assert.equal(upgradeDuck(other, PRESETS), other);
  const single = { ...old, frames: [blank] };
  assert.equal(upgradeDuck(single, PRESETS), single);
  assert.equal(upgradeDuck(null, PRESETS), null);
});

test('a traced path is thinned, measured and stored as fractions of the window', async () => {
  const { thin, lengthOf, toPath } = await import('../js/path-draw.js');
  const line = Array.from({ length: 101 }, (_, i) => [100 + i * 4, 200]); // 400 px, a point every 4 px
  const kept = thin(line);
  assert.ok(kept.length < 40 && kept.length > 20);
  assert.equal(lengthOf([[0, 0], [3, 4], [3, 14]]), 15);
  const path = toPath(line, 1000, 800);
  assert.deepEqual(path[0], [0.1, 0.25]);
  assert.ok(path.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1));
  assert.equal(toPath([[10, 10], [20, 20]], 1000, 800), null); // a slip, not a path
  assert.equal(toPath([[10, 10]], 1000, 800), null);
  assert.deepEqual(toPath([[-50, 400], [2000, 400]], 1000, 800), [[0, 0.5], [1, 0.5]]); // clamped
  const long = Array.from({ length: 5000 }, (_, i) => [(i % 2) * 900, i]);
  assert.ok(toPath(long, 1000, 5000).length <= 400);
});

test('the walking modes survive a share link, and old links keep their meaning', async () => {
  const { ROAMS, encodeDuck, decodeDuck } = await import('../js/duck-format.js');
  const { PRESETS } = await import('../data/presets.js');
  assert.deepEqual(ROAMS.slice(0, 2), ['strip', 'page']); // links store the index
  for (const roam of ROAMS) {
    const result = await decodeDuck(await encodeDuck({ ...PRESETS[0], roam }));
    assert.equal(result.ok && result.duck.roam, roam);
  }
});

test('walking speed is its own slider and defaults to energy for older ducks', async () => {
  const { validateDuck, encodeDuck, decodeDuck, packDuck, unpackDuck } = await import('../js/duck-format.js');
  const { behaviour } = await import('../js/personality.js');
  const { PRESETS } = await import('../data/presets.js');
  const old = structuredClone(PRESETS[0]);
  old.personality = { sass: 50, energy: 80, helpfulness: 50, chattiness: 50, codeFocus: 50 };
  assert.equal(validateDuck(old).duck.personality.speed, 80);
  assert.equal(behaviour(old.personality).walkSpeed, 100); // as before the slider existed
  // A link made before the slider: the same bytes without the last one.
  const bytes = packDuck(validateDuck(old).duck);
  assert.equal(validateDuck(unpackDuck(bytes.subarray(0, bytes.length - 1))).duck.personality.speed, 80);
  const fast = { ...PRESETS[0], personality: { ...PRESETS[0].personality, energy: 10, speed: 95 } };
  assert.equal(behaviour(fast.personality).walkSpeed, 115);
  assert.equal(behaviour(fast.personality).idlePauseMs, 4000 - 30 * 10);
  assert.equal((await decodeDuck(await encodeDuck(fast))).duck.personality.speed, 95);
  for (const bad of [101, 7, -5, '50']) {
    assert.equal(validateDuck({ ...fast, personality: { ...fast.personality, speed: bad } }).reason, 'personality');
  }
});

test('R7: a JavaScript semicolon hunch needs a habit or a joined line', () => {
  const semis = (text, options) => checkCode(text, 'javascript', options).findings
    .filter((f) => f.kind === 'semicolon').map((f) => f.line);
  const ended = (n) => Array.from({ length: n }, (_, i) => `const v${i} = ${i};`).join('\n');

  // Habit: at least five lines ending in a semicolon, and at least 80% of the lot.
  assert.deepEqual(semis(`${ended(5)}\nconst last = 1\nconsole.log(last);`), [6]);
  assert.deepEqual(semis(`${ended(3)}\nconst last = 1\nconsole.log(last);`), []); // only four
  assert.deepEqual(semis(`${ended(8)}\nconst a = 1\nconst b = 2\nlog(a, b);`), [9, 10]); // 9 of 11
  assert.deepEqual(semis(`${ended(7)}\nconst a = 1\nconst b = 2\nlog(a, b)`), []); // 7 of 10
  // No habit, no hunch: code written without semicolons.
  assert.deepEqual(semis('const a = 1\nconst b = 2\nlet c = a + b\nconsole.log(c)\nexport default c'), []);

  // Joined lines are flagged whatever the habit, and with or without the parser.
  const joined = 'const a = [1, 2]\nconst b = a.length\n(function () { return b })()';
  assert.deepEqual(semis(joined), [2]);
  assert.deepEqual(semis(joined, { useParser: false }), [2]);
  assert.deepEqual(semis('const t = tag\n`text`'), [1]);
  assert.deepEqual(semis('const n = list\n[0]'), [1]);
  // Not joined: the first line cannot end there anyway, or the second defends itself.
  assert.deepEqual(semis('function f() {\n  return\n  (1 + 2)\n}'), []);
  assert.deepEqual(semis('if (ready)\n  (async () => {})()'), []);
  assert.deepEqual(semis('const a = 1\n;[1, 2].forEach(log)'), []);
  assert.deepEqual(semis('export default\n[1, 2]'), []);
  assert.deepEqual(semis('while (go) {\n  break\n  (x)\n}'), []);
  assert.deepEqual(semis('for (const x of xs) {\n  continue\n  [x]\n}'), []);
  assert.deepEqual(semis('const total = add(\n  1,\n  2\n)\nlog(total)'), []);

  // Quiet when the code is broken in a way that makes line endings unreliable.
  assert.deepEqual(semis(`${ended(6)}\nconst x = (1\nlog(x);`), []);
  assert.deepEqual(semis(`${ended(6)}\nconst s = "open\nlog(s);`), []);
  // Other languages are untouched: R3 still does their semicolons.
  assert.equal(checkCode('int a = 1\nint b = 2;', 'java').findings[0].rule, 'R3');
});
