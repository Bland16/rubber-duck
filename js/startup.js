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

// Before 2026-10-12 the preset frames came from separately drawn sheets and the
// ducks in them differed in shape. A duck still built on those frames (recognised
// by its old "walking" frame) is given the current frames and animations. Its
// name, colours, personality, languages and walking mode are kept; pixels redrawn
// on the old frames are not.
const OLD_WALKING_FRAME = 1257446927;
function hash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h;
}

export function upgradeDuck(duck, presets) {
  if (!duck || duck.frames.length < 2 || hash(duck.frames[1]) !== OLD_WALKING_FRAME) return duck;
  const preset = presets[0]; // every preset has the same frames and animations
  return {
    ...duck,
    // The new frames use every preset colour slot; a shorter palette is topped up.
    palette: [...duck.palette, ...preset.palette.slice(duck.palette.length)],
    frames: [...preset.frames],
    animations: JSON.parse(JSON.stringify(preset.animations)),
  };
}
