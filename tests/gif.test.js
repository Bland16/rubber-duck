import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeGif } from '../js/export/gif.js';

// A small GIF reader written for this test: enough to walk the blocks and
// decode each frame's LZW data back to palette indices.
function readGif(bytes) {
  let at = 0;
  const u8 = () => bytes[at++];
  const u16 = () => { at += 2; return bytes[at - 2] | (bytes[at - 1] << 8); };
  const subBlocks = () => {
    const out = [];
    for (let size = u8(); size; size = u8()) for (let i = 0; i < size; i += 1) out.push(u8());
    return out;
  };

  const gif = { signature: String.fromCharCode(...bytes.slice(0, 6)), frames: [], loop: null };
  at = 6;
  gif.width = u16();
  gif.height = u16();
  const packed = u8();
  at += 2;
  gif.tableSize = packed & 0x80 ? 2 << (packed & 7) : 0;
  gif.table = [];
  for (let i = 0; i < gif.tableSize; i += 1) gif.table.push([u8(), u8(), u8()]);

  let control = null;
  for (;;) {
    const block = u8();
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = u8();
      if (label === 0xf9) {
        u8();
        const flags = u8();
        control = { disposal: (flags >> 2) & 7, transparent: Boolean(flags & 1), delay: u16(), index: u8() };
        u8();
      } else if (label === 0xff) {
        const size = u8();
        const id = String.fromCharCode(...bytes.slice(at, at + size));
        at += size;
        const data = subBlocks();
        if (id === 'NETSCAPE2.0') gif.loop = data[1] | (data[2] << 8);
      } else subBlocks();
    } else if (block === 0x2c) {
      const frame = { left: u16(), top: u16(), width: u16(), height: u16(), flags: u8(), control };
      frame.pixels = unLzw(u8(), subBlocks(), frame.width * frame.height);
      gif.frames.push(frame);
      control = null;
    } else throw new Error(`unexpected block ${block} at ${at}`);
  }
  gif.trailing = bytes.length - at;
  return gif;
}

function unLzw(minCodeSize, data, pixelCount) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out = [];
  let codeSize = minCodeSize + 1;
  let table = [];
  const reset = () => {
    table = [];
    for (let i = 0; i < clear; i += 1) table[i] = [i];
    table[clear] = [];
    table[end] = [];
    codeSize = minCodeSize + 1;
  };
  reset();
  let buffer = 0;
  let bits = 0;
  let previous = null;
  for (const byte of data) {
    buffer |= byte << bits;
    bits += 8;
    while (bits >= codeSize) {
      const code = buffer & ((1 << codeSize) - 1);
      buffer >>= codeSize;
      bits -= codeSize;
      if (code === clear) { reset(); previous = null; continue; }
      if (code === end) return out;
      let entry;
      if (code < table.length) entry = table[code];
      else if (code === table.length && previous) entry = [...previous, previous[0]];
      else throw new Error(`bad LZW code ${code}`);
      out.push(...entry);
      if (previous && table.length < 4096) {
        table.push([...previous, entry[0]]);
        if (table.length === 1 << codeSize && codeSize < 12) codeSize += 1;
      }
      previous = entry;
    }
  }
  assert.equal(out.length, pixelCount);
  return out;
}

const palette = ['#ff0000', '#00ff00', '#0000ff', '#123456'];

test('header, colour table, loop and frames', () => {
  const frames = [Uint8Array.from([0, 1, 2, 3, 4, 0, 1, 2]), Uint8Array.from([4, 4, 4, 4, 0, 0, 0, 0])];
  const gif = readGif(encodeGif({ width: 4, height: 2, palette, frames, delays: [17, 50] }));
  assert.equal(gif.signature, 'GIF89a');
  assert.equal(gif.width, 4);
  assert.equal(gif.height, 2);
  assert.equal(gif.tableSize, 16);
  assert.deepEqual(gif.table.slice(1, 5), [[255, 0, 0], [0, 255, 0], [0, 0, 255], [0x12, 0x34, 0x56]]);
  assert.equal(gif.loop, 0);
  assert.equal(gif.frames.length, 2);
  assert.equal(gif.trailing, 0);
  gif.frames.forEach((frame, i) => {
    assert.deepEqual(frame.pixels, [...frames[i]]);
    assert.deepEqual([frame.left, frame.top, frame.width, frame.height], [0, 0, 4, 2]);
    assert.deepEqual(frame.control, { disposal: 2, transparent: true, delay: [17, 50][i], index: 0 });
  });
});

test('large and noisy frames survive the LZW round trip', () => {
  const side = 256;
  let seed = 5;
  const noisy = Uint8Array.from({ length: side * side }, () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % 16;
  });
  const flat = new Uint8Array(side * side).fill(7);
  const stripes = Uint8Array.from({ length: side * side }, (_, i) => Math.floor(i / 8) % 16);
  const fullPalette = Array.from({ length: 15 }, (_, i) => `#${(i * 16).toString(16).padStart(2, '0')}aa55`);
  const gif = readGif(encodeGif({ width: side, height: side, palette: fullPalette, frames: [noisy, flat, stripes], delays: [10, 10, 10] }));
  assert.deepEqual(gif.frames[0].pixels, [...noisy]);
  assert.deepEqual(gif.frames[1].pixels, [...flat]);
  assert.deepEqual(gif.frames[2].pixels, [...stripes]);
});

test('delays follow round(100 / fps)', () => {
  for (const fps of [1, 2, 3, 6, 7, 12]) {
    const delay = Math.round(100 / fps);
    const gif = readGif(encodeGif({ width: 1, height: 1, palette, frames: [Uint8Array.from([1])], delays: [delay] }));
    assert.equal(gif.frames[0].control.delay, delay);
  }
});
