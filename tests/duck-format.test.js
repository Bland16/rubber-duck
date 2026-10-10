import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDuck, encodeDuck, decodeDuck, deleteFrame, packDuck, cloneDuck, bytesToFrame, FRAME_BYTES, MAX_FRAMES,
} from '../js/duck-format.js';
import { PRESETS } from '../data/presets.js';

const base = () => cloneDuck(PRESETS[0]);
const reasonOf = (mutate) => {
  const duck = base();
  mutate(duck);
  return validateDuck(duck).reason;
};
const frameOf = (value) => bytesToFrame(new Uint8Array(FRAME_BYTES).fill(value));

test('a valid duck passes and comes back equal', () => {
  const result = validateDuck(base());
  assert.equal(result.ok, true);
  assert.deepEqual(result.duck, base());
});

test('not an object', () => {
  for (const value of [null, 3, 'duck', [], undefined]) assert.equal(validateDuck(value).reason, 'not-object');
});

test('version rules', () => {
  assert.equal(reasonOf((d) => { d.v = 2; }), 'version-newer');
  assert.equal(reasonOf((d) => { d.v = 0; }), 'version');
  assert.equal(reasonOf((d) => { d.v = '1'; }), 'version');
  assert.equal(reasonOf((d) => { delete d.v; }), 'version');
});

test('the version is reported before a bad name', () => {
  assert.equal(reasonOf((d) => { d.v = 3; d.name = 5; }), 'version-newer');
});

test('unknown keys, top level and nested', () => {
  assert.equal(reasonOf((d) => { d.extra = 1; }), 'unknown-key');
  assert.equal(reasonOf((d) => { d.animations.dance = d.animations.idle; }), 'unknown-key');
  assert.equal(reasonOf((d) => { d.animations.idle.speed = 2; }), 'unknown-key');
  assert.equal(reasonOf((d) => { d.personality.luck = 5; }), 'unknown-key');
});

test('name rules', () => {
  assert.equal(reasonOf((d) => { d.name = 7; }), 'name');
  assert.equal(reasonOf((d) => { d.name = 'x'.repeat(25); }), 'name');
  const trimmed = validateDuck({ ...base(), name: `  ${'x'.repeat(24)}  ` });
  assert.equal(trimmed.ok, true);
  assert.equal(trimmed.duck.name, 'x'.repeat(24));
  assert.equal(validateDuck({ ...base(), name: '' }).ok, true);
});

test('palette rules', () => {
  assert.equal(reasonOf((d) => { d.palette = []; }), 'palette');
  assert.equal(reasonOf((d) => { d.palette = Array(16).fill('#000000'); }), 'palette');
  assert.equal(reasonOf((d) => { d.palette[0] = '#FFF000'; }), 'palette');
  assert.equal(reasonOf((d) => { d.palette[0] = 'red'; }), 'palette');
  assert.equal(reasonOf((d) => { d.palette = 'none'; }), 'palette');
});

test('frame rules', () => {
  assert.equal(reasonOf((d) => { d.frames = []; }), 'frames');
  assert.equal(reasonOf((d) => { d.frames = Array(MAX_FRAMES + 1).fill(d.frames[0]); }), 'frames');
  assert.equal(reasonOf((d) => { d.frames[0] = d.frames[0].slice(4); }), 'frames');
  assert.equal(reasonOf((d) => { d.frames[0] = '!!!'; }), 'frames');
  assert.equal(reasonOf((d) => { d.frames[0] = frameOf(d.palette.length + 1); }), 'frames');
  assert.equal(reasonOf((d) => { d.frames[0] = 12; }), 'frames');
});

test('animation rules', () => {
  assert.equal(reasonOf((d) => { delete d.animations.sleep; }), 'animations');
  assert.equal(reasonOf((d) => { d.animations.idle.seq = []; }), 'animations');
  assert.equal(reasonOf((d) => { d.animations.idle.seq = Array(9).fill(0); }), 'animations');
  assert.equal(reasonOf((d) => { d.animations.idle.seq = [d.frames.length]; }), 'animations');
  assert.equal(reasonOf((d) => { d.animations.idle.seq = [0.5]; }), 'animations');
  assert.equal(reasonOf((d) => { d.animations.idle.fps = 0; }), 'animations');
  assert.equal(reasonOf((d) => { d.animations.idle.fps = 13; }), 'animations');
  assert.equal(reasonOf((d) => { d.animations.idle.motion = 'spin'; }), 'animations');
  assert.equal(reasonOf((d) => { delete d.animations.idle.fps; }), 'animations');
  assert.equal(reasonOf((d) => { d.animations = []; }), 'animations');
});

test('personality rules', () => {
  assert.equal(reasonOf((d) => { d.personality.sass = 101; }), 'personality');
  assert.equal(reasonOf((d) => { d.personality.sass = -5; }), 'personality');
  assert.equal(reasonOf((d) => { d.personality.sass = 37; }), 'personality');
  assert.equal(reasonOf((d) => { delete d.personality.energy; }), 'personality');
  assert.equal(reasonOf((d) => { d.personality = null; }), 'personality');
});

test('language and roam rules', () => {
  assert.equal(reasonOf((d) => { d.languages = ['rust']; }), 'languages');
  assert.equal(reasonOf((d) => { d.languages = ['java', 'java']; }), 'languages');
  assert.equal(reasonOf((d) => { d.languages = 'java'; }), 'languages');
  assert.equal(reasonOf((d) => { d.roam = 'sky'; }), 'roam');
  assert.equal(reasonOf((d) => { delete d.roam; }), 'roam');
});

test('every preset survives encode then decode', async () => {
  for (const preset of PRESETS) {
    const result = await decodeDuck(await encodeDuck(preset));
    assert.equal(result.ok, true);
    assert.deepEqual(result.duck, preset);
  }
});

test('a full-size duck survives encode then decode', async () => {
  const duck = base();
  duck.name = '鴨'.repeat(24);
  duck.palette = Array.from({ length: 15 }, (_, i) => `#${(i * 17).toString(16).padStart(2, '0')}80ff`);
  duck.frames = Array.from({ length: MAX_FRAMES }, (_, i) => frameOf(i % 16));
  duck.animations.walk.seq = [MAX_FRAMES - 1, 0, 7, 3, 15, 1, 2, 8];
  duck.personality = { sass: 0, energy: 100, helpfulness: 5, chattiness: 95, codeFocus: 0, speed: 35 };
  duck.languages = ['java', 'javascript', 'python', 'c'];
  duck.roam = 'page';
  assert.equal(validateDuck(duck).ok, true);
  const result = await decodeDuck(await encodeDuck(duck));
  assert.deepEqual(result, { ok: true, duck });
});

test('the Classic share link is at most 4,000 characters', async () => {
  const link = `https://bland16.github.io/rubber-duck/#d=${await encodeDuck(PRESETS[0])}`;
  assert.ok(link.length <= 4000, `link is ${link.length} characters`);
});

const deflate = async (bytes) => {
  const stream = new CompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return Buffer.from(buffer).toString('base64url');
};

test('decode refuses oversized input', async () => {
  assert.equal((await decodeDuck('A'.repeat(20001))).reason, 'too-long');
  const bomb = await deflate(new Uint8Array(200000));
  assert.ok(bomb.length < 20000);
  assert.equal((await decodeDuck(bomb)).reason, 'too-long');
});

test('decode reports corrupt input', async () => {
  assert.equal((await decodeDuck('')).reason, 'corrupt');
  assert.equal((await decodeDuck('not base64 url!')).reason, 'corrupt');
  assert.equal((await decodeDuck('AAAAA')).reason, 'corrupt');
  const packed = packDuck(base());
  assert.equal((await decodeDuck(await deflate(packed.subarray(0, packed.length - 3)))).reason, 'corrupt');
  assert.equal((await decodeDuck(await deflate(Uint8Array.from([...packed, 0])))).reason, 'corrupt');
  const good = await encodeDuck(base());
  assert.equal((await decodeDuck(good.slice(0, Math.floor(good.length / 2)))).reason, 'corrupt');
});

test('decode reports a newer format version', async () => {
  const packed = packDuck(base());
  packed[0] = 2;
  assert.equal((await decodeDuck(await deflate(packed))).reason, 'version-newer');
});

test('deleting a frame remaps every sequence', () => {
  const duck = base();
  duck.animations.idle.seq = [0, 1, 2, 3, 4];
  const next = deleteFrame(duck, 2);
  assert.equal(next.frames.length, duck.frames.length - 1);
  assert.deepEqual(next.animations.idle.seq, [0, 1, 0, 2, 3]);
  assert.equal(next.frames[2], duck.frames[3]);
  assert.equal(validateDuck(next).ok, true);
  assert.deepEqual(duck.animations.idle.seq, [0, 1, 2, 3, 4]);
});

test('the last frame cannot be deleted', () => {
  const duck = base();
  duck.frames = [duck.frames[0]];
  for (const key of Object.keys(duck.animations)) duck.animations[key].seq = [0];
  assert.equal(deleteFrame(duck, 0).frames.length, 1);
});
