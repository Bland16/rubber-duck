import { test } from 'node:test';
import assert from 'node:assert/strict';
import responses from '../js/responses.js';
import { createPicker, composeHunches, chatterKey, buddyKey } from '../js/response-picker.js';
import { PRESETS } from '../data/presets.js';

const VOICES = ['senior', 'hype', 'chaos', 'goth'];
const KINDS = ['string', 'comment', 'bracket', 'semicolon', 'assign', 'indent'];
const SASS = ['mild', 'spicy'];
const DETAILS = ['vague', 'line', 'fix'];

// Deterministic random source.
const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

// A picker that records the keys it is asked for and echoes them back.
const recorder = () => {
  const keys = [];
  return { keys, pick: (key) => { keys.push(key); return `[${key}] {name} {line}`; } };
};

const duckWith = (personality, name = 'Quackers') => ({
  ...PRESETS[0], name, personality: { sass: 70, energy: 20, helpfulness: 70, chattiness: 50, codeFocus: 50, ...personality },
});
const finding = (kind, line) => ({ rule: 'R', kind, line });
const ok = (findings, unsure = false) => ({ status: 'ok', findings, unsure });

// ── Pool contract ──────────────────────────────────────────────────────────

const required = new Map();
for (const voice of VOICES) {
  for (const sass of SASS) {
    for (const kind of KINDS) for (const detail of DETAILS) required.set(`hunch.${voice}.${kind}.${sass}.${detail}`, 2);
    required.set(`hunch.${voice}.parse.${sass}.vague`, 2);
    for (const topic of ['code', 'general']) required.set(`chatter.${voice}.${sass}.${topic}`, 5);
  }
  for (const state of ['empty', 'toolong', 'clean', 'unsure']) required.set(`state.${voice}.${state}`, 2);
  required.set(`buddy.${voice}`, 5);
}

test('the pool has exactly the required keys with enough lines', () => {
  assert.deepEqual(Object.keys(responses).sort(), [...required.keys()].sort());
  for (const [key, minimum] of required) {
    assert.ok(Array.isArray(responses[key]) && responses[key].length >= minimum, key);
    assert.ok(responses[key].every((line) => typeof line === 'string' && line.trim()), key);
  }
});

test('placeholders and length limits', () => {
  for (const [key, lines] of Object.entries(responses)) {
    for (const line of lines) {
      const placeholders = line.match(/\{[^}]*\}/g) || [];
      assert.ok(placeholders.every((p) => p === '{line}' || p === '{name}'), `${key}: ${line}`);
      const filled = line.replaceAll('{name}', 'N'.repeat(24)).replaceAll('{line}', '12345');
      assert.ok(filled.length <= 125, `${key} is ${filled.length} characters: ${line}`);
      const wantsLine = /^hunch\..*\.(line|fix)$/.test(key);
      assert.equal(line.includes('{line}'), wantsLine, `${key}: ${line}`);
    }
  }
});

// ── Picker ─────────────────────────────────────────────────────────────────

test('picker: no immediate repeat, and every line is dealt before any repeats', () => {
  const pool = { two: ['a', 'b'], five: ['a', 'b', 'c', 'd', 'e'] };
  for (const key of Object.keys(pool)) {
    const picker = createPicker(pool, seeded(7));
    const picks = Array.from({ length: 1000 }, () => picker.pick(key));
    picks.forEach((line, i) => { if (i) assert.notEqual(line, picks[i - 1], `${key} repeated at ${i}`); });
    const size = pool[key].length;
    for (let i = 0; i + size <= picks.length; i += size) {
      assert.equal(new Set(picks.slice(i, i + size)).size, size, `${key} round at ${i}`);
    }
  }
});

test('picker: a one-line key and an unknown key', () => {
  const picker = createPicker({ one: ['only'] }, seeded());
  assert.equal(picker.pick('one'), 'only');
  assert.equal(picker.pick('one'), 'only');
  assert.throws(() => picker.pick('missing'), /Unknown response key/);
});

// ── composeHunches ─────────────────────────────────────────────────────────

test('how many hunches, by helpfulness', () => {
  const findings = [finding('string', 1), finding('bracket', 2), finding('semicolon', 3), finding('assign', 4), finding('assign', 9)];
  const expected = { 0: 1, 30: 1, 35: 2, 65: 2, 70: 3, 100: 3 };
  for (const [helpfulness, count] of Object.entries(expected)) {
    const hunches = composeHunches(ok(findings), duckWith({ helpfulness: Number(helpfulness) }), recorder());
    assert.equal(hunches.length, count, `helpfulness ${helpfulness}`);
    assert.ok(hunches[count - 1].endsWith(` (+${5 - count} more)`));
    hunches.slice(0, -1).forEach((h) => assert.ok(!h.includes('more)')));
  }
});

test('no "(+K more)" when nothing was left out', () => {
  const hunches = composeHunches(ok([finding('string', 1), finding('bracket', 2)]), duckWith({ helpfulness: 100 }), recorder());
  assert.equal(hunches.length, 2);
  assert.ok(hunches.every((h) => !h.includes('more)')));
});

test('the key asked for follows voice, sass and detail', () => {
  const cases = [
    [{ sass: 45, helpfulness: 30 }, 'hunch.senior.bracket.mild.vague'],
    [{ sass: 50, helpfulness: 35 }, 'hunch.senior.bracket.spicy.line'],
    [{ sass: 95, helpfulness: 100 }, 'hunch.senior.bracket.spicy.fix'],
    [{ sass: 10, energy: 90, helpfulness: 80, chattiness: 80 }, 'hunch.hype.bracket.mild.fix'],
    [{ sass: 80, energy: 80, helpfulness: 10, chattiness: 70 }, 'hunch.chaos.bracket.spicy.vague'],
    [{ sass: 90, energy: 30, helpfulness: 50, chattiness: 10 }, 'hunch.goth.bracket.spicy.line'],
  ];
  for (const [personality, key] of cases) {
    const picker = recorder();
    composeHunches(ok([finding('bracket', 12)]), duckWith(personality), picker);
    assert.deepEqual(picker.keys, [key]);
  }
});

test('parse and line-less findings always use vague', () => {
  const picker = recorder();
  composeHunches(ok([finding('parse', null), finding('assign', 4)]), duckWith({ helpfulness: 100 }), picker);
  assert.deepEqual(picker.keys, ['hunch.senior.parse.spicy.vague', 'hunch.senior.assign.spicy.fix']);
});

test('placeholders are filled, and an unnamed duck is Duck', () => {
  const named = composeHunches(ok([finding('semicolon', 42)]), duckWith({}), recorder());
  assert.deepEqual(named, ['[hunch.senior.semicolon.spicy.fix] Quackers 42']);
  const unnamed = composeHunches(ok([finding('semicolon', 42)]), duckWith({}, ''), recorder());
  assert.deepEqual(unnamed, ['[hunch.senior.semicolon.spicy.fix] Duck 42']);
});

test('the four states', () => {
  const ask = (result) => {
    const picker = recorder();
    const lines = composeHunches(result, duckWith({}), picker);
    assert.equal(lines.length, 1);
    return picker.keys[0];
  };
  assert.equal(ask({ status: 'empty', findings: [], unsure: false }), 'state.senior.empty');
  assert.equal(ask({ status: 'too-long', findings: [], unsure: false }), 'state.senior.toolong');
  assert.equal(ask(ok([])), 'state.senior.clean');
  assert.equal(ask(ok([], true)), 'state.senior.unsure');
});

test('composeHunches works against the real pool for every voice and kind', () => {
  const picker = createPicker(responses, seeded(3));
  const personalities = [
    { sass: 70, energy: 20, helpfulness: 70, chattiness: 50 },
    { sass: 10, energy: 90, helpfulness: 80, chattiness: 80 },
    { sass: 80, energy: 80, helpfulness: 10, chattiness: 70 },
    { sass: 90, energy: 30, helpfulness: 50, chattiness: 10 },
  ];
  for (const personality of personalities) {
    for (const kind of [...KINDS, 'parse']) {
      const lines = composeHunches(ok([finding(kind, kind === 'parse' ? null : 99999), finding('assign', 3), finding('assign', 5), finding('assign', 8)]),
        duckWith(personality, 'N'.repeat(24)), picker);
      for (const line of lines) {
        assert.ok(line.length <= 140, `${line.length}: ${line}`);
        assert.ok(!/\{(line|name)\}/.test(line), line);
      }
    }
  }
});

test('chatter and buddy keys exist for every combination', () => {
  for (const personality of [{ sass: 0 }, { sass: 100 }]) {
    for (const aboutCode of [true, false]) assert.ok(responses[chatterKey(duckWith(personality), aboutCode)]);
  }
  assert.ok(responses[buddyKey(duckWith({}))]);
});
