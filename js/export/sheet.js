// Sprite sheet PNG and animated GIF.

import { SIZE } from '../duck-format.js';
import { pixelsOf, drawPixels, sheetSize, frameAt, shiftPixels } from '../sprite-render.js';
import { encodeGif } from './gif.js';

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be made.'))), 'image/png');
  });
}

export function sheetBlob(duck, scale) {
  const { width, height } = sheetSize(duck.frames.length, scale);
  const canvas = Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d');
  duck.frames.forEach((frame, index) => {
    drawPixels(ctx, pixelsOf(frame), duck.palette, { x: index * SIZE * scale, scale });
  });
  return canvasToBlob(canvas);
}

// The frames of one loop of an animation, as scaled indexed pixels. A motion
// alternates every step, so an odd-length sequence needs two passes to loop.
export function gifFrames(duck, animationName, scale) {
  const animation = duck.animations[animationName];
  const length = animation.seq.length;
  const steps = animation.motion !== 'none' && length % 2 === 1 ? length * 2 : length;
  const side = SIZE * scale;
  const frames = [];
  for (let step = 0; step < steps; step += 1) {
    const shown = frameAt(animation, step);
    const small = shiftPixels(pixelsOf(duck.frames[shown.frame]), shown.dx, shown.dy);
    const big = new Uint8Array(side * side);
    for (let y = 0; y < side; y += 1) {
      const row = Math.floor(y / scale) * SIZE;
      for (let x = 0; x < side; x += 1) big[y * side + x] = small[row + Math.floor(x / scale)];
    }
    frames.push(big);
  }
  return {
    width: side,
    height: side,
    palette: duck.palette,
    frames,
    delays: frames.map(() => Math.round(100 / animation.fps)),
  };
}

export function gifBlob(duck, animationName, scale) {
  return new Blob([encodeGif(gifFrames(duck, animationName, scale))], { type: 'image/gif' });
}
