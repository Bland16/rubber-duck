// localStorage autosave and preferences. A blocked or full store never throws.

import { validateDuck } from './duck-format.js';

const DUCK = 'buildaduck.v1.duck';
const BACKUP = 'buildaduck.v1.backup';
const PREFS = 'buildaduck.v1.prefs';

export const DEFAULT_PREFS = {
  muted: false,
  paused: false,
  theme: null,
  controlsOpen: false,
  sectionsCollapsed: {},
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience; the page works without it.
  }
}

function readDuck(key) {
  const result = validateDuck(read(key));
  return result.ok ? result.duck : null;
}

export const loadDuck = () => readDuck(DUCK);
export const loadBackup = () => readDuck(BACKUP);
export const saveDuck = (duck) => write(DUCK, duck);
export const saveBackup = (duck) => write(BACKUP, duck);

export function loadPrefs() {
  const stored = read(PREFS);
  const prefs = { ...DEFAULT_PREFS, ...(stored && typeof stored === 'object' ? stored : {}) };
  if (typeof prefs.sectionsCollapsed !== 'object' || prefs.sectionsCollapsed === null) prefs.sectionsCollapsed = {};
  return prefs;
}

export const savePrefs = (prefs) => write(PREFS, prefs);
