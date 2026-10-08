import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCode } from '../js/syntax/index.js';

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), 'corpus');
const LANGUAGES = ['java', 'c', 'javascript', 'python'];
const APPLICABLE = {
  java: ['string', 'comment', 'bracket', 'semicolon', 'assign'],
  c: ['string', 'comment', 'bracket', 'semicolon', 'assign'],
  javascript: ['string', 'comment', 'bracket', 'parse', 'assign'],
  python: ['string', 'bracket', 'assign', 'indent'],
};

const sources = (dir) => (existsSync(dir) ? readdirSync(dir) : [])
  .filter((name) => !name.endsWith('.expect.json'))
  .map((name) => ({ name, path: join(dir, name) }));

for (const language of LANGUAGES) {
  const valid = sources(join(CORPUS, language, 'valid'));
  const broken = sources(join(CORPUS, language, 'broken'));

  test(`corpus ${language}: required size and coverage`, () => {
    assert.ok(valid.length >= 15, `${valid.length} valid snippets`);
    assert.ok(broken.length >= 12, `${broken.length} broken snippets`);
    const kinds = broken.map((file) => JSON.parse(readFileSync(`${file.path}.expect.json`, 'utf8')).kind);
    for (const kind of APPLICABLE[language]) {
      assert.ok(kinds.filter((k) => k === kind).length >= 2, `fewer than 2 broken snippets of kind ${kind}`);
    }
  });

  test(`corpus ${language}: at most 1 valid snippet produces a finding`, () => {
    const noisy = valid.filter((file) => {
      const result = checkCode(readFileSync(file.path, 'utf8'), language);
      return result.findings.length > 0;
    }).map((file) => file.name);
    assert.ok(noisy.length <= 1, `valid snippets with findings: ${noisy.join(', ')}`);
  });

  test(`corpus ${language}: at least 85% of broken snippets are caught`, () => {
    const missed = broken.filter((file) => {
      const expected = JSON.parse(readFileSync(`${file.path}.expect.json`, 'utf8'));
      const result = checkCode(readFileSync(file.path, 'utf8'), language);
      return !result.findings.some((f) => f.kind === expected.kind
        && (expected.kind === 'parse' || Math.abs(f.line - expected.line) <= 1));
    }).map((file) => file.name);
    const caught = broken.length - missed.length;
    assert.ok(caught / broken.length >= 0.85, `caught ${caught}/${broken.length}; missed: ${missed.join(', ')}`);
  });
}
