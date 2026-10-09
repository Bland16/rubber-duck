import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseStartupDuck, adopt, restore, NOTICES } from '../js/startup.js';
import { traitWords, label, isBuddy, behaviour, SLIDER_INFO } from '../js/personality.js';
import { motionOffset, sheetSize, frameAt, shiftPixels } from '../js/sprite-render.js';
import { slug } from '../js/export/slug.js';
import { createStore } from '../js/store.js';
import { validateDuck, frameToBytes, cloneDuck, SIZE } from '../js/duck-format.js';
import { PRESETS, BODY_SLOTS, BELLY_ROW } from '../data/presets.js';

const classic = PRESETS[0];
const mine = { ...cloneDuck(PRESETS[1]), name: 'Mine' };
const theirs = { ...cloneDuck(PRESETS[2]), name: 'Theirs' };
const person = (over = {}) => ({ sass: 50, energy: 50, helpfulness: 50, chattiness: 50, codeFocus: 50, ...over });

// ── startup ────────────────────────────────────────────────────────────────

for (const saved of [null, mine]) {
  const own = saved || classic;
  const tag = saved ? 'with a saved duck' : 'with no saved duck';

  test(`startup: valid payload, ${tag}`, () => {
    const result = chooseStartupDuck({ payloadResult: { ok: true, duck: theirs }, saved, fallback: classic });
    assert.equal(result.duck, theirs);
    assert.equal(result.mode, 'visiting');
    assert.equal(result.notice.text, "You're looking at Theirs. Edit it to make it yours.");
    assert.equal(result.notice.action, saved ? 'back' : null);
  });

  test(`startup: newer-version payload, ${tag}`, () => {
    const result = chooseStartupDuck({ payloadResult: { ok: false, reason: 'version-newer' }, saved, fallback: classic });
    assert.deepEqual(result, { duck: own, mode: 'own', notice: { text: NOTICES.newer, action: null } });
  });

  test(`startup: damaged payload, ${tag}`, () => {
    for (const reason of ['corrupt', 'too-long', 'frames', 'version']) {
      const result = chooseStartupDuck({ payloadResult: { ok: false, reason }, saved, fallback: classic });
      assert.deepEqual(result, { duck: own, mode: 'own', notice: { text: NOTICES.damaged, action: null } });
    }
  });

  test(`startup: no payload, ${tag}`, () => {
    assert.deepEqual(chooseStartupDuck({ payloadResult: null, saved, fallback: classic }), { duck: own, mode: 'own', notice: null });
  });
}

test('startup: an unnamed visited duck is called Duck', () => {
  const result = chooseStartupDuck({ payloadResult: { ok: true, duck: { ...theirs, name: '' } }, saved: null, fallback: classic });
  assert.match(result.notice.text, /looking at Duck\./);
});

test('adopt keeps the previous duck when there is one', () => {
  assert.deepEqual(adopt({ duck: theirs, saved: mine }), {
    save: theirs, backup: mine, notice: { text: NOTICES.adopted, action: 'restore' },
  });
  assert.deepEqual(adopt({ duck: theirs, saved: null }), { save: theirs, backup: null, notice: null });
});

test('restore swaps the duck and the backup', () => {
  assert.deepEqual(restore({ duck: theirs, backup: mine }), { duck: mine, backup: theirs });
});

// ── personality ────────────────────────────────────────────────────────────

test('label at each centre, at all-50 and at a tie', () => {
  assert.equal(label(person({ sass: 70, energy: 20, helpfulness: 70, chattiness: 50 })), 'Senior Engineer');
  assert.equal(label(person({ sass: 10, energy: 90, helpfulness: 80, chattiness: 80 })), 'Hype Duck');
  assert.equal(label(person({ sass: 80, energy: 80, helpfulness: 10, chattiness: 70 })), 'Chaos Duck');
  assert.equal(label(person({ sass: 90, energy: 30, helpfulness: 50, chattiness: 10 })), 'Goth Duck');
  assert.equal(label(person()), 'Senior Engineer');
  // Equidistant from Senior (70,20,70,50) and Goth (90,30,50,10): the earlier row wins.
  assert.equal(label(person({ sass: 80, energy: 25, helpfulness: 60, chattiness: 30 })), 'Senior Engineer');
});

test('trait words at the band edges of every slider', () => {
  SLIDER_INFO.forEach((info, index) => {
    const expected = { 0: 0, 30: 0, 35: 1, 65: 1, 70: 2, 100: 2 };
    for (const [value, bandIndex] of Object.entries(expected)) {
      assert.equal(traitWords(person({ [info.key]: Number(value) }))[index], info.words[bandIndex]);
    }
  });
  assert.deepEqual(traitWords(person({ codeFocus: 5 }))[4], 'Casual');
});

test('buddy mode is on only at code focus 0', () => {
  assert.equal(isBuddy(person({ codeFocus: 0 })), true);
  assert.equal(isBuddy(person({ codeFocus: 5 })), false);
});

test('behaviour numbers', () => {
  assert.deepEqual(behaviour(person({ energy: 0, chattiness: 0, codeFocus: 0 })), {
    idlePauseMs: 4000, walkSpeed: 20, sleepAfterMs: 20000, chatterEveryMs: null, codeChatterChance: 0,
  });
  assert.deepEqual(behaviour(person()), {
    idlePauseMs: 2500, walkSpeed: 70, sleepAfterMs: 40000, chatterEveryMs: 35000, codeChatterChance: 0.5,
  });
  assert.deepEqual(behaviour(person({ energy: 100, chattiness: 100, codeFocus: 100 })), {
    idlePauseMs: 1000, walkSpeed: 120, sleepAfterMs: 60000, chatterEveryMs: 10000, codeChatterChance: 1,
  });
});

// ── render helpers ─────────────────────────────────────────────────────────

test('motionOffset for each motion at steps 0 to 3', () => {
  const at = (motion) => [0, 1, 2, 3].map((step) => motionOffset(motion, step));
  const rest = { dx: 0, dy: 0 };
  assert.deepEqual(at('none'), [rest, rest, rest, rest]);
  assert.deepEqual(at('bob'), [rest, { dx: 0, dy: -1 }, rest, { dx: 0, dy: -1 }]);
  assert.deepEqual(at('hop'), [rest, { dx: 0, dy: -2 }, rest, { dx: 0, dy: -2 }]);
  assert.deepEqual(at('shake'), [rest, { dx: -1, dy: 0 }, rest, { dx: -1, dy: 0 }]);
});

test('a one-frame sequence still alternates', () => {
  const sleep = { seq: [3], fps: 1, motion: 'bob' };
  assert.deepEqual(frameAt(sleep, 0), { frame: 3, dx: 0, dy: 0 });
  assert.deepEqual(frameAt(sleep, 1), { frame: 3, dx: 0, dy: -1 });
  assert.deepEqual(frameAt(sleep, 1, true), { frame: 3, dx: 0, dy: 0 });
});

test('sheet size for 1, 8 and 16 frames at each scale', () => {
  for (const frames of [1, 8, 16]) {
    for (const scale of [1, 4, 8]) {
      assert.deepEqual(sheetSize(frames, scale), { width: 32 * frames * scale, height: 32 * scale });
    }
  }
});

test('shifted pixels move, and drop off the edge', () => {
  const bytes = new Uint8Array(SIZE * SIZE);
  bytes[0] = 1; // top left
  bytes[5 * SIZE + 5] = 2;
  const up = shiftPixels(bytes, 0, -1);
  assert.equal(up[4 * SIZE + 5], 2);
  assert.equal(up.filter((v) => v === 1).length, 0);
  assert.equal(shiftPixels(bytes, -1, 0)[5 * SIZE + 4], 2);
  assert.equal(shiftPixels(bytes, 0, 0), bytes);
});

// ── slug ───────────────────────────────────────────────────────────────────

test('slug', () => {
  assert.equal(slug('Sir Quacks-a-Lot'), 'sir-quacks-a-lot');
  assert.equal(slug('  My   Duck!! '), 'my-duck');
  assert.equal(slug('R2/D2 & co.'), 'r2-d2-co');
  assert.equal(slug('鴨鴨'), 'duck');
  assert.equal(slug(''), 'duck');
});

// ── store ──────────────────────────────────────────────────────────────────

test('undo and redo restore art but keep name and personality', () => {
  const store = createStore(classic);
  store.change({ ...store.get(), palette: ['#000000'] });
  store.change({ ...store.get(), name: 'Renamed' }, { history: false });
  assert.equal(store.canUndo(), true);
  store.undo();
  assert.deepEqual(store.get().palette, classic.palette);
  assert.equal(store.get().name, 'Renamed');
  store.redo();
  assert.deepEqual(store.get().palette, ['#000000']);
  assert.equal(store.canRedo(), false);
});

test('a checkpoint makes a whole stroke one undo step', () => {
  const store = createStore(classic);
  store.checkpoint();
  store.change({ ...store.get(), palette: ['#111111'] }, { history: false });
  store.change({ ...store.get(), palette: ['#222222'] }, { history: false });
  store.undo();
  assert.deepEqual(store.get().palette, classic.palette);
  assert.equal(store.canUndo(), false);
});

test('undo history is capped at 50 and emptied by replace', () => {
  const store = createStore(classic);
  for (let i = 0; i < 60; i += 1) store.change({ ...store.get(), name: String(i) });
  let steps = 0;
  while (store.canUndo()) {
    store.undo();
    steps += 1;
  }
  assert.equal(steps, 50);
  store.change({ ...store.get(), palette: ['#000000'] });
  store.replace(classic);
  assert.equal(store.canUndo(), false);
});

// ── presets ────────────────────────────────────────────────────────────────

test('all four presets are valid ducks', () => {
  assert.deepEqual(PRESETS.map((p) => p.name), ['Classic', 'Midnight', 'Bubblegum', 'Ghost']);
  for (const preset of PRESETS) assert.deepEqual(validateDuck(preset), { ok: true, duck: preset });
});

test('presets share frames and animations and differ in palette', () => {
  for (const preset of PRESETS.slice(1)) {
    assert.deepEqual(preset.frames, classic.frames);
    assert.deepEqual(preset.animations, classic.animations);
    assert.notDeepEqual(preset.palette, classic.palette);
  }
});

test('every preset frame has its belly line on BELLY_ROW and keeps the motion margins', () => {
  classic.frames.forEach((frame, index) => {
    const bytes = frameToBytes(frame);
    // Walk-cycle frames (8 on) can have a stray body-coloured cell in a foot, and
    // a long-legged stride lifts the body one row.
    const stride = index >= 8;
    let belly = -1;
    for (let y = 0; y < SIZE; y += 1) {
      let bodyCells = 0;
      for (let x = 0; x < SIZE; x += 1) {
        const value = bytes[y * SIZE + x];
        if (!value) continue;
        if (BODY_SLOTS.includes(value)) bodyCells += 1;
        assert.ok(x >= 1 && x <= 30 && y >= 2 && y <= 31, `frame ${index} has a pixel at column ${x}, row ${y}`);
      }
      if (bodyCells >= (stride ? 6 : 1)) belly = y;
    }
    if (stride) assert.ok(belly === BELLY_ROW || belly === BELLY_ROW - 1, `frame ${index}: belly on row ${belly}`);
    else assert.equal(belly, BELLY_ROW, `frame ${index}`);
  });
});
