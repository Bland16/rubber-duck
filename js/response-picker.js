// Chooses what the duck says. Pure: the pool and the random source are passed in.

import { personalityOf, sassLevel, band } from './personality.js';

const DETAILS = ['vague', 'line', 'fix'];

// pick(key) deals each key's lines from a shuffled copy, reshuffling only when
// all have been dealt, and never repeats a line twice in a row.
export function createPicker(pool, rng = Math.random) {
  const decks = new Map();
  const last = new Map();

  const shuffled = (lines) => {
    const deck = [...lines];
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  return {
    pick(key) {
      const lines = pool[key];
      if (!Array.isArray(lines) || !lines.length) throw new Error(`Unknown response key: ${key}`);
      let deck = decks.get(key);
      if (!deck || !deck.length) {
        deck = shuffled(lines);
        // Dealt from the end, so the next line out is the last entry.
        if (deck.length > 1 && deck[deck.length - 1] === last.get(key)) {
          [deck[deck.length - 1], deck[deck.length - 2]] = [deck[deck.length - 2], deck[deck.length - 1]];
        }
        decks.set(key, deck);
      }
      const line = deck.pop();
      last.set(key, line);
      return line;
    },
  };
}

export function fill(template, duck, line) {
  // Function replacers, so a `$` in a name is not read as a replacement pattern.
  return template.replaceAll('{name}', () => duck.name || 'Duck').replaceAll('{line}', () => String(line));
}

export function voiceOf(duck) {
  return personalityOf(duck.personality).voice;
}

// Turns a checkCode result into the 1 to 3 strings the duck says, in order.
export function composeHunches(result, duck, picker) {
  const voice = voiceOf(duck);
  const state = (name) => [fill(picker.pick(`state.${voice}.${name}`), duck, '')];
  if (result.status === 'empty') return state('empty');
  if (result.status === 'too-long') return state('toolong');
  if (!result.findings.length) return state(result.unsure ? 'unsure' : 'clean');

  const helpfulness = band(duck.personality.helpfulness);
  const sass = sassLevel(duck.personality);
  const shown = result.findings.slice(0, helpfulness + 1);
  const hunches = shown.map((finding) => {
    const detail = finding.kind === 'parse' || finding.line == null ? 'vague' : DETAILS[helpfulness];
    return fill(picker.pick(`hunch.${voice}.${finding.kind}.${sass}.${detail}`), duck, finding.line);
  });
  const left = result.findings.length - shown.length;
  if (left > 0) hunches[hunches.length - 1] += ` (+${left} more)`;
  return hunches;
}

export function chatterKey(duck, aboutCode) {
  return `chatter.${voiceOf(duck)}.${sassLevel(duck.personality)}.${aboutCode ? 'code' : 'general'}`;
}

export function buddyKey(duck) {
  return `buddy.${voiceOf(duck)}`;
}
