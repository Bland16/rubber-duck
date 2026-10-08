// Sliders -> trait words, personality label, buddy mode and behaviour numbers. Pure.

export const SLIDER_INFO = [
  { key: 'sass', label: 'Sass', words: ['Polite', 'Dry', 'Savage'] },
  { key: 'energy', label: 'Energy', words: ['Sleepy', 'Steady', 'Zoomy'] },
  { key: 'helpfulness', label: 'Helpfulness', words: ['Cryptic', 'Fair', 'Mentor'] },
  { key: 'chattiness', label: 'Chattiness', words: ['Quiet', 'Chatty', 'Never stops'] },
  { key: 'codeFocus', label: 'Code focus', words: ['Casual', 'Curious', 'Obsessed'] },
];

// Centres are (sass, energy, helpfulness, chattiness). Earlier rows win ties.
export const PERSONALITIES = [
  { voice: 'senior', label: 'Senior Engineer', centre: [70, 20, 70, 50] },
  { voice: 'hype', label: 'Hype Duck', centre: [10, 90, 80, 80] },
  { voice: 'chaos', label: 'Chaos Duck', centre: [80, 80, 10, 70] },
  { voice: 'goth', label: 'Goth Duck', centre: [90, 30, 50, 10] },
];

// 0 for 0-30, 1 for 35-65, 2 for 70-100.
export function band(value) {
  return value <= 30 ? 0 : value <= 65 ? 1 : 2;
}

export function traitWords(p) {
  return SLIDER_INFO.map((info) => info.words[band(p[info.key])]);
}

export function personalityOf(p) {
  const point = [p.sass, p.energy, p.helpfulness, p.chattiness];
  let best = PERSONALITIES[0];
  let bestDistance = Infinity;
  for (const candidate of PERSONALITIES) {
    const distance = candidate.centre.reduce((sum, c, i) => sum + (c - point[i]) ** 2, 0);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function label(p) {
  return personalityOf(p).label;
}

export function isBuddy(p) {
  return p.codeFocus === 0;
}

export function sassLevel(p) {
  return p.sass < 50 ? 'mild' : 'spicy';
}

export function behaviour(p) {
  return {
    idlePauseMs: 4000 - 30 * p.energy,
    walkSpeed: 20 + p.energy,
    sleepAfterMs: 20000 + 400 * p.energy,
    chatterEveryMs: p.chattiness === 0 ? null : 60000 - 500 * p.chattiness,
    codeChatterChance: p.codeFocus / 100,
  };
}
