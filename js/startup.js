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
// duck still built on preset frames is touched.
//  - Before the walk cycle (frames 8 to 11) existed, ducks walked on the standing
//    pose and one stride, or on that stride and a made-up second one.
//  - Before the carried and landing poses (frames 12 and 13) existed, those two
//    animations were filled in as copies of idle.
export function upgradeDuck(duck, presets) {
  if (!duck) return duck;
  const preset = presets[0]; // every preset has the same frames and animations
  if (duck.frames[1] !== preset.frames[1]) return duck;
  let next = duck;

  const walk = next.animations.walk.seq.join();
  if ((next.frames.length === 8 && walk === '0,1') || (next.frames.length === 9 && walk === '1,8')) {
    next = {
      ...next,
      frames: [...next.frames.slice(0, 8), ...preset.frames.slice(8, 12)],
      animations: { ...next.animations, walk: { ...preset.animations.walk } },
    };
  }

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const old = preset.palette.length - 2; // the splash added two colours at the end
  if (next.frames.length === 12 && next.frames[8] === preset.frames[8] && next.palette.length === old
    && same(next.animations.carried, next.animations.idle) && same(next.animations.landing, next.animations.idle)) {
    next = {
      ...next,
      palette: [...next.palette, ...preset.palette.slice(old)],
      frames: [...next.frames, ...preset.frames.slice(12)],
      animations: { ...next.animations, carried: { ...preset.animations.carried }, landing: { ...preset.animations.landing } },
    };
  }
  return next;
}
