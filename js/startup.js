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
