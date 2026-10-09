// The duck object: schema, validation, and the packed share-link form. No DOM.

export const VERSION = 1;
export const SIZE = 32;
export const FRAME_BYTES = SIZE * SIZE;
export const MAX_FRAMES = 16;
export const MAX_COLOURS = 15;
export const MAX_NAME = 24;
export const MAX_SEQ = 8;
export const ANIMATION_NAMES = ['idle', 'walk', 'squeak', 'sleep', 'thinking'];
export const MOTIONS = ['none', 'bob', 'hop', 'shake'];
export const SLIDERS = ['sass', 'energy', 'helpfulness', 'chattiness', 'codeFocus'];
export const LANGUAGES = ['java', 'javascript', 'python', 'c'];
export const ROAMS = ['strip', 'page', 'sit', 'path']; // new values go at the end: links store the index
export const MAX_PAYLOAD = 20000;

const TOP_KEYS = ['v', 'name', 'palette', 'frames', 'animations', 'personality', 'languages', 'roam'];
const ANIMATION_KEYS = ['seq', 'fps', 'motion'];

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const hasUnknown = (obj, allowed) => Object.keys(obj).some((k) => !allowed.includes(k));

export function frameToBytes(frame) {
  const binary = atob(frame);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToFrame(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function cloneDuck(duck) {
  return JSON.parse(JSON.stringify(duck));
}

function validFrame(frame, colours) {
  if (typeof frame !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(frame)) return false;
  let bytes;
  try {
    bytes = frameToBytes(frame);
  } catch {
    return false;
  }
  return bytes.length === FRAME_BYTES && bytes.every((b) => b <= colours);
}

// Returns { ok: true, duck } with a normalised copy, or { ok: false, reason }.
export function validateDuck(value) {
  const no = (reason) => ({ ok: false, reason });
  if (!isObject(value)) return no('not-object');
  if (Number.isInteger(value.v) && value.v > VERSION) return no('version-newer');
  if (value.v !== VERSION) return no('version');

  if (hasUnknown(value, TOP_KEYS)) return no('unknown-key');
  if (isObject(value.animations)) {
    if (hasUnknown(value.animations, ANIMATION_NAMES)) return no('unknown-key');
    const entries = Object.values(value.animations);
    if (entries.some((a) => isObject(a) && hasUnknown(a, ANIMATION_KEYS))) return no('unknown-key');
  }
  if (isObject(value.personality) && hasUnknown(value.personality, SLIDERS)) return no('unknown-key');

  if (typeof value.name !== 'string') return no('name');
  const name = value.name.trim();
  if (name.length > MAX_NAME) return no('name');

  const { palette, frames, animations, personality, languages, roam } = value;
  if (!Array.isArray(palette) || palette.length < 1 || palette.length > MAX_COLOURS
    || !palette.every((c) => typeof c === 'string' && /^#[0-9a-f]{6}$/.test(c))) return no('palette');

  if (!Array.isArray(frames) || frames.length < 1 || frames.length > MAX_FRAMES
    || !frames.every((f) => validFrame(f, palette.length))) return no('frames');

  if (!isObject(animations)) return no('animations');
  for (const key of ANIMATION_NAMES) {
    const a = animations[key];
    if (!isObject(a) || !Array.isArray(a.seq) || a.seq.length < 1 || a.seq.length > MAX_SEQ
      || !a.seq.every((i) => isInt(i, 0, frames.length - 1))
      || !isInt(a.fps, 1, 12) || !MOTIONS.includes(a.motion)) return no('animations');
  }

  if (!isObject(personality)
    || !SLIDERS.every((k) => isInt(personality[k], 0, 100) && personality[k] % 5 === 0)) return no('personality');

  if (!Array.isArray(languages) || new Set(languages).size !== languages.length
    || !languages.every((l) => LANGUAGES.includes(l))) return no('languages');

  if (!ROAMS.includes(roam)) return no('roam');

  const duck = cloneDuck({ v: VERSION, name, palette, frames, animations: {}, personality: {}, languages, roam });
  for (const key of ANIMATION_NAMES) {
    duck.animations[key] = { seq: [...animations[key].seq], fps: animations[key].fps, motion: animations[key].motion };
  }
  for (const key of SLIDERS) duck.personality[key] = personality[key];
  return { ok: true, duck };
}

// Removes frame k and keeps every animation pointing at a frame that exists.
export function deleteFrame(duck, k) {
  if (duck.frames.length <= 1) return duck;
  const next = cloneDuck(duck);
  next.frames.splice(k, 1);
  for (const key of ANIMATION_NAMES) {
    next.animations[key].seq = next.animations[key].seq.map((i) => (i === k ? 0 : i > k ? i - 1 : i));
  }
  return next;
}

// ── Packed form ────────────────────────────────────────────────────────────

export function packDuck(duck) {
  const out = [VERSION];
  const name = new TextEncoder().encode(duck.name);
  out.push(name.length, ...name);
  out.push(duck.palette.length);
  for (const colour of duck.palette) {
    out.push(parseInt(colour.slice(1, 3), 16), parseInt(colour.slice(3, 5), 16), parseInt(colour.slice(5, 7), 16));
  }
  out.push(duck.frames.length);
  for (const frame of duck.frames) {
    const bytes = frameToBytes(frame);
    for (let i = 0; i < FRAME_BYTES; i += 2) out.push((bytes[i] << 4) | bytes[i + 1]);
  }
  for (const key of ANIMATION_NAMES) {
    const a = duck.animations[key];
    out.push(a.seq.length, ...a.seq, a.fps, MOTIONS.indexOf(a.motion));
  }
  for (const key of SLIDERS) out.push(duck.personality[key]);
  out.push(LANGUAGES.reduce((mask, l, bit) => mask | (duck.languages.includes(l) ? 1 << bit : 0), 0));
  out.push(ROAMS.indexOf(duck.roam));
  return Uint8Array.from(out);
}

// Returns a plain object for validateDuck, or throws on truncated or trailing bytes.
export function unpackDuck(bytes) {
  let pos = 0;
  const take = (n = 1) => {
    if (pos + n > bytes.length) throw new Error('truncated');
    pos += n;
    return n === 1 ? bytes[pos - 1] : bytes.subarray(pos - n, pos);
  };
  const duck = { v: take() };
  if (duck.v !== VERSION) return duck;
  duck.name = new TextDecoder('utf-8', { fatal: true }).decode(take(take()).slice());
  duck.palette = Array.from({ length: take() }, () => `#${[...take(3)].map((b) => b.toString(16).padStart(2, '0')).join('')}`);
  duck.frames = Array.from({ length: take() }, () => {
    const packed = take(FRAME_BYTES / 2);
    const frame = new Uint8Array(FRAME_BYTES);
    packed.forEach((b, i) => {
      frame[i * 2] = b >> 4;
      frame[i * 2 + 1] = b & 15;
    });
    return bytesToFrame(frame);
  });
  duck.animations = {};
  for (const key of ANIMATION_NAMES) {
    const length = take();
    const seq = Array.from({ length }, () => take());
    duck.animations[key] = { seq, fps: take(), motion: MOTIONS[take()] };
  }
  duck.personality = {};
  for (const key of SLIDERS) duck.personality[key] = take();
  const mask = take();
  if (mask > 15) throw new Error('languages');
  duck.languages = LANGUAGES.filter((_, bit) => mask & (1 << bit));
  duck.roam = ROAMS[take()];
  if (pos !== bytes.length) throw new Error('trailing');
  return duck;
}

async function transform(bytes, stream, limit) {
  const writer = stream.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      throw new RangeError('too-long');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

export async function encodeDuck(duck) {
  const packed = await transform(packDuck(duck), new CompressionStream('deflate-raw'), Infinity);
  return bytesToFrame(packed).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function decodeDuck(payload) {
  const no = (reason) => ({ ok: false, reason });
  if (typeof payload !== 'string' || payload.length > MAX_PAYLOAD) return no('too-long');
  if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) return no('corrupt');
  let raw;
  try {
    const compressed = frameToBytes(payload.replace(/-/g, '+').replace(/_/g, '/'));
    raw = await transform(compressed, new DecompressionStream('deflate-raw'), MAX_PAYLOAD);
  } catch (error) {
    return no(error instanceof RangeError && error.message === 'too-long' ? 'too-long' : 'corrupt');
  }
  if (raw.length && raw[0] > VERSION) return no('version-newer');
  let unpacked;
  try {
    unpacked = unpackDuck(raw);
  } catch {
    return no('corrupt');
  }
  return validateDuck(unpacked);
}
