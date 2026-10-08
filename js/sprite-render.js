// Drawing frames to canvases. The helpers at the top are pure.

import { SIZE, FRAME_BYTES, frameToBytes } from './duck-format.js';

export const MARGIN = 2; // spare sprite pixels around a drawn frame, so motions never clip

export function motionOffset(motion, step) {
  if (step % 2 === 0) return { dx: 0, dy: 0 };
  if (motion === 'bob') return { dx: 0, dy: -1 };
  if (motion === 'hop') return { dx: 0, dy: -2 };
  if (motion === 'shake') return { dx: -1, dy: 0 };
  return { dx: 0, dy: 0 };
}

export function sheetSize(frameCount, scale) {
  return { width: SIZE * frameCount * scale, height: SIZE * scale };
}

// Which frame and offset an animation shows at a step counted from its start.
export function frameAt(animation, step, still = false) {
  if (still) return { frame: animation.seq[0], dx: 0, dy: 0 };
  return { frame: animation.seq[step % animation.seq.length], ...motionOffset(animation.motion, step) };
}

// A frame's pixels moved by (dx, dy); pixels pushed outside the frame are dropped.
export function shiftPixels(bytes, dx, dy) {
  if (!dx && !dy) return bytes;
  const out = new Uint8Array(FRAME_BYTES);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) out[ny * SIZE + nx] = bytes[y * SIZE + x];
    }
  }
  return out;
}

const decoded = new Map();

// Decoded pixels for a frame string, cached because frames are immutable strings.
export function pixelsOf(frame) {
  let bytes = decoded.get(frame);
  if (!bytes) {
    bytes = frameToBytes(frame);
    if (decoded.size > 400) decoded.clear();
    decoded.set(frame, bytes);
  }
  return bytes;
}

// Draws one frame with its top-left sprite pixel at (x, y) in canvas pixels.
export function drawPixels(ctx, bytes, palette, { x = 0, y = 0, scale = 1, flip = false } = {}) {
  for (let py = 0; py < SIZE; py += 1) {
    for (let px = 0; px < SIZE; px += 1) {
      const value = bytes[py * SIZE + px];
      if (!value) continue;
      ctx.fillStyle = palette[value - 1];
      const column = flip ? SIZE - 1 - px : px;
      ctx.fillRect(x + column * scale, y + py * scale, scale, scale);
    }
  }
}

// Sizes a canvas for one frame plus the motion margin and draws into it.
export function drawSprite(canvas, duck, frameIndex, { scale = 1, flip = false, dx = 0, dy = 0 } = {}) {
  const side = (SIZE + MARGIN * 2) * scale;
  if (canvas.width !== side) canvas.width = side;
  if (canvas.height !== side) canvas.height = side;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, side, side);
  const frame = duck.frames[frameIndex] ?? duck.frames[0];
  drawPixels(ctx, pixelsOf(frame), duck.palette, {
    x: (MARGIN + (flip ? -dx : dx)) * scale,
    y: (MARGIN + dy) * scale,
    scale,
    flip,
  });
}

// A plain thumbnail with no margin.
export function drawThumb(canvas, duck, frameIndex, scale = 1) {
  const side = SIZE * scale;
  if (canvas.width !== side) canvas.width = side;
  if (canvas.height !== side) canvas.height = side;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, side, side);
  const frame = duck.frames[frameIndex] ?? duck.frames[0];
  drawPixels(ctx, pixelsOf(frame), duck.palette, { scale });
}
