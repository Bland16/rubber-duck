// Which duck to show at startup, and what adopting a visited duck does. Pure.

export const NOTICES = {
  newer: 'This duck was made with a newer version of Build-a-Duck.',
  damaged: 'That duck link is damaged, so here is your own duck instead.',
  adopted: 'This duck is yours now. Your previous duck was kept.',
};

const displayName = (duck) => duck.name || 'Duck';

// payloadResult: the decodeDuck result for the #d= payload, or null when there
// is none. saved: the validated autosaved duck, or null. fallback: Classic.
export function chooseStartupDuck({ payloadResult, saved, fallback }) {
  const own = saved || fallback;
  if (!payloadResult) return { duck: own, mode: 'own', notice: null };
  if (payloadResult.ok) {
    return {
      duck: payloadResult.duck,
      mode: 'visiting',
      notice: {
        text: `You're looking at ${displayName(payloadResult.duck)}. Edit it to make it yours.`,
        action: saved ? 'back' : null,
      },
    };
  }
  const text = payloadResult.reason === 'version-newer' ? NOTICES.newer : NOTICES.damaged;
  return { duck: own, mode: 'own', notice: { text, action: null } };
}

// The first edit of a visited duck: what to save, what to back up, what to say.
export function adopt({ duck, saved }) {
  return {
    save: duck,
    backup: saved || null,
    notice: saved ? { text: NOTICES.adopted, action: 'restore' } : null,
  };
}

// "Restore previous duck" swaps the current duck and the backup.
export function restore({ duck, backup }) {
  return { duck: backup, backup: duck };
}

// Brings a duck saved by an earlier version of the presets up to date. Only a
// duck still built on preset frames is touched, one step at a time:
//  1. Before any walk cycle existed, ducks walked on the standing pose and one
//     stride, or on that stride and a made-up second one.
//  2. Two earlier walk cycles were replaced; their frames are recognised by hash,
//     so a walk someone has redrawn is left alone.
//  3. Before the carried and landing poses (frames 12 and 13) existed, those two
//     animations were filled in as copies of idle.
//  4. For a while the walk had six frames (14 and 15 were the extra two) and
//     its third frame carried a stray line. The line is cleaned, and the extra
//     frames are dropped unless an animation was pointed at them on purpose.
const OLD_WALK_CYCLES = [
  [260288631, 3348737659, 4060367774, 3249513251],
  [2727605289, 4206680096, 3116754440, 688719657],
];
const STRAY_LINE_FRAME = 2766044795; // frame 10 before the clean-up
const EXTRA_WALK_FRAMES = [1653668924, 2423067582]; // frames 14 and 15
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h;
}

export function upgradeDuck(duck, presets) {
  if (!duck) return duck;
  const preset = presets[0]; // every preset has the same frames and animations
  if (duck.frames[1] !== preset.frames[1]) return duck;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const fourStep = { ...preset.animations.walk, seq: [...preset.animations.walk.seq] };
  let next = duck;

  const walk = next.animations.walk.seq.join();
  if ((next.frames.length === 8 && walk === '0,1') || (next.frames.length === 9 && walk === '1,8')) {
    next = {
      ...next,
      frames: [...next.frames.slice(0, 8), ...preset.frames.slice(8, 12)],
      animations: { ...next.animations, walk: fourStep },
    };
  }

  if (next.frames.length >= 12
    && OLD_WALK_CYCLES.some((cycle) => cycle.every((h, i) => hash(next.frames[8 + i]) === h))) {
    const frames = [...next.frames];
    frames.splice(8, 4, ...preset.frames.slice(8, 12));
    // Those cycles ran at 8 frames a second by default; carry the new default over.
    const untouched = same(next.animations.walk, { seq: [8, 9, 10, 11], fps: 8, motion: 'bob' });
    next = { ...next, frames, animations: untouched ? { ...next.animations, walk: fourStep } : next.animations };
  }

  const old = preset.palette.length - 2; // the splash added two colours at the end
  if (next.frames.length === 12 && next.frames[8] === preset.frames[8] && next.palette.length === old
    && same(next.animations.carried, next.animations.idle) && same(next.animations.landing, next.animations.idle)) {
    next = {
      ...next,
      palette: [...next.palette, ...preset.palette.slice(old)],
      frames: [...next.frames, ...preset.frames.slice(12, 14)],
      animations: { ...next.animations, carried: { ...preset.animations.carried }, landing: { ...preset.animations.landing } },
    };
  }

  if (next.frames.length > 10 && hash(next.frames[10]) === STRAY_LINE_FRAME) {
    const frames = [...next.frames];
    frames[10] = preset.frames[10];
    next = { ...next, frames };
  }
  if (next.frames.length === 16 && EXTRA_WALK_FRAMES.every((h, i) => hash(next.frames[14 + i]) === h)) {
    let { animations } = next;
    if (animations.walk.seq.join() === '8,9,10,11,14,15') animations = { ...animations, walk: fourStep };
    if (!Object.values(animations).some((a) => a.seq.some((i) => i >= 14))) {
      next = { ...next, frames: next.frames.slice(0, 14), animations };
    }
  }
  return next;
}
