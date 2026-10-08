// The 1200x627 share card.

import { SIZE } from '../duck-format.js';
import { pixelsOf, drawPixels } from '../sprite-render.js';
import { SLIDER_INFO, traitWords, label, isBuddy } from '../personality.js';

export const CARD = { width: 1200, height: 627 };
const FONT = 'ui-monospace, Consolas, Menlo, monospace';
const INK = '#111111';

export function drawCard(canvas, duck) {
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#9fd3e6';
  ctx.fillRect(0, 0, CARD.width, CARD.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(40, 40, CARD.width - 80, CARD.height - 80);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.strokeRect(43, 43, CARD.width - 86, CARD.height - 86);

  const scale = 12;
  const frame = duck.frames[duck.animations.idle.seq[0]];
  drawPixels(ctx, pixelsOf(frame), duck.palette, { x: 96, y: Math.round((CARD.height - SIZE * scale) / 2), scale });

  const left = 560;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText(duck.name || 'Duck', left, 150, 560);
  ctx.font = `36px ${FONT}`;
  ctx.fillText(label(duck.personality) + (isBuddy(duck.personality) ? ' · Buddy mode' : ''), left, 205, 560);

  const words = traitWords(duck.personality);
  ctx.lineWidth = 3;
  SLIDER_INFO.forEach((info, index) => {
    const y = 270 + index * 52;
    ctx.fillStyle = INK;
    ctx.font = `22px ${FONT}`;
    ctx.fillText(info.label, left, y);
    ctx.strokeRect(left + 155, y - 19, 300, 20);
    ctx.fillRect(left + 155, y - 19, 3 * duck.personality[info.key], 20);
    ctx.font = `20px ${FONT}`;
    ctx.fillText(words[index], left + 469, y, 117);
  });

  ctx.font = `28px ${FONT}`;
  ctx.fillText('bland16.github.io/rubber-duck', left, 548);
}
