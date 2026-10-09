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

test('a duck saved before the walk cycle existed is upgraded', async () => {
  const { upgradeDuck: upgradeWalk } = await import('../js/startup.js');
  const { PRESETS } = await import('../data/presets.js');
  const { validateDuck } = await import('../js/duck-format.js');
  // As storage hands it over: validated, so carried and landing are copies of idle.
  const stored = structuredClone(PRESETS[1]);
  stored.frames.length = 8;
  stored.palette.length -= 2;
  stored.animations.walk.seq = [0, 1];
  delete stored.animations.carried;
  delete stored.animations.landing;
  stored.name = 'Mine';
  const old = validateDuck(stored).duck;
  assert.deepEqual(old.animations.carried, old.animations.idle);
  const upgraded = upgradeWalk(old, PRESETS);
  assert.deepEqual(upgraded.animations, PRESETS[1].animations);
  assert.deepEqual(upgraded.palette, PRESETS[1].palette);
  assert.deepEqual(upgraded.frames, PRESETS[1].frames);
  assert.equal(upgraded.name, 'Mine');
  assert.equal(validateDuck(upgraded).ok, true);
  // The in-between version: nine frames, walking on 1 and a made-up frame 8.
  const between = structuredClone(old);
  between.frames.push(between.frames[0]);
  between.animations.walk.seq = [1, 8];
  assert.deepEqual(upgradeWalk(between, PRESETS).frames, PRESETS[1].frames);
  // The version with the walk cycle but no carried or landing pose.
  const twelve = structuredClone(old);
  twelve.frames = PRESETS[1].frames.slice(0, 12);
  twelve.animations.walk = { seq: [8, 9, 10, 11], fps: 8, motion: 'bob' };
  assert.deepEqual(upgradeWalk(twelve, PRESETS), { ...PRESETS[1], name: 'Mine' });
  // A four-step walk someone slowed down keeps its four steps.
  const slowed = structuredClone(PRESETS[1]);
  slowed.frames.length = 14;
  slowed.animations.walk = { seq: [8, 9, 10, 11], fps: 3, motion: 'bob' };
  assert.equal(upgradeWalk(slowed, PRESETS), slowed);
  // A carried animation someone chose on purpose is kept.
  const chosen = structuredClone(twelve);
  chosen.animations.carried.seq = [2];
  assert.equal(upgradeWalk(chosen, PRESETS).frames.length, 12);
  // Left alone: a current duck, a redrawn walk frame, a changed sequence, nothing saved.
  assert.equal(upgradeWalk(PRESETS[0], PRESETS), PRESETS[0]);
  const redrawn = structuredClone(old); redrawn.frames[1] = redrawn.frames[0];
  assert.equal(upgradeWalk(redrawn, PRESETS), redrawn);
  const resequenced = structuredClone(old); resequenced.animations.walk.seq = [1];
  assert.equal(upgradeWalk(resequenced, PRESETS), resequenced);
  assert.equal(upgradeWalk(PRESETS[2], PRESETS), PRESETS[2]);
  assert.equal(upgradeWalk(null, PRESETS), null);
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
