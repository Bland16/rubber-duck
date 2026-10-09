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

test('a duck saved before the second walking stride is upgraded', async () => {
  const { upgradeWalk } = await import('../js/startup.js');
  const { PRESETS } = await import('../data/presets.js');
  const { validateDuck } = await import('../js/duck-format.js');
  const old = structuredClone(PRESETS[1]);
  old.frames.length = 8;
  old.animations.walk.seq = [0, 1];
  old.name = 'Mine';
  const upgraded = upgradeWalk(old, PRESETS);
  assert.deepEqual(upgraded.animations.walk.seq, [1, 8]);
  assert.equal(upgraded.frames[8], PRESETS[1].frames[8]);
  assert.equal(upgraded.name, 'Mine');
  assert.equal(validateDuck(upgraded).ok, true);
  // Left alone: a current duck, a redrawn walk frame, a changed sequence, nothing saved.
  assert.equal(upgradeWalk(PRESETS[0], PRESETS), PRESETS[0]);
  const redrawn = structuredClone(old); redrawn.frames[1] = redrawn.frames[0];
  assert.equal(upgradeWalk(redrawn, PRESETS), redrawn);
  const resequenced = structuredClone(old); resequenced.animations.walk.seq = [1];
  assert.equal(upgradeWalk(resequenced, PRESETS), resequenced);
  assert.equal(upgradeWalk(null, PRESETS), null);
});
