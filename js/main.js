// Wiring only: creates the modules and passes the duck between them.

import { decodeDuck } from './duck-format.js';
import { chooseStartupDuck, adopt, restore } from './startup.js';
import { createStore } from './store.js';
import { createPicker } from './response-picker.js';
import { createEditor, isEdited } from './editor.js';
import { createPersonalityPanel, createExportPanel } from './panels.js';
import { createStage } from './stage.js';
import { createViewer } from './viewer.js';
import { showNotice, dismissNotice, confirmAction } from './notice.js';
import * as storage from './storage.js';
import responses from './responses.js';
import { PRESETS } from '../data/presets.js';

const AUTOSAVE_MS = 500;
const VIEW_ONLY = '(max-width: 639.98px), ((pointer: coarse) and (max-height: 499.98px))';

const payloadOf = (hash) => (hash.startsWith('#d=') ? hash.slice(3) : null);
const clearFragment = () => history.replaceState(null, '', location.pathname + location.search);

async function start() {
  const prefs = storage.loadPrefs();
  const fallback = PRESETS[0];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const viewOnly = window.matchMedia(VIEW_ONLY);
  const shortWindow = window.matchMedia('(max-height: 520px)'); // matches the shorter stage in the CSS

  const payload = payloadOf(location.hash);
  const first = chooseStartupDuck({
    payloadResult: payload === null ? null : await decodeDuck(payload),
    saved: storage.loadDuck(),
    fallback,
  });
  let mode = first.mode;
  if (mode === 'own' && payload !== null) clearFragment(); // a link that could not be opened
  const store = createStore(first.duck);

  // ── Notices that carry actions ───────────────────────────────────────────

  function present(notice) {
    if (!notice) return;
    const actions = {
      back: { label: 'Back to my duck', onClick: backToMine },
      restore: { label: 'Restore previous duck', onClick: restorePrevious },
    };
    showNotice(notice.text, { action: notice.action ? actions[notice.action] : null });
  }

  function backToMine() {
    clearFragment();
    mode = 'own';
    store.replace(storage.loadDuck() || fallback, 'load');
  }

  function restorePrevious() {
    const backup = storage.loadBackup();
    if (!backup) return;
    const swapped = restore({ duck: store.get(), backup });
    storage.saveBackup(swapped.backup);
    store.replace(swapped.duck);
  }

  // The same action stays available in the Export panel while a backup exists.
  const restoreButton = document.getElementById('restore-backup');
  const showRestore = () => { restoreButton.hidden = !storage.loadBackup(); };
  restoreButton.addEventListener('click', () => {
    dismissNotice();
    restorePrevious();
  });

  // ── Autosave and adoption ────────────────────────────────────────────────

  let saveTimer = null;
  const flush = () => {
    if (saveTimer === null) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    if (mode === 'own') storage.saveDuck(store.get());
  };

  store.subscribe((duck, reason) => {
    if (reason !== 'edit') return;
    if (mode === 'visiting') {
      const result = adopt({ duck, saved: storage.loadDuck() });
      if (result.backup) storage.saveBackup(result.backup);
      storage.saveDuck(result.save);
      clearFragment();
      mode = 'own';
      if (result.notice) present(result.notice);
      else dismissNotice();
      showRestore();
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, AUTOSAVE_MS);
  });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  window.addEventListener('hashchange', async () => {
    const next = payloadOf(location.hash);
    if (next === null) return;
    if (mode === 'own' && isEdited(store.get(), PRESETS)
      && !(await confirmAction('Open the duck from this link? Your own duck stays saved.', 'Open'))) {
      clearFragment();
      return;
    }
    flush();
    const chosen = chooseStartupDuck({ payloadResult: await decodeDuck(next), saved: storage.loadDuck(), fallback });
    mode = chosen.mode;
    if (mode === 'own') clearFragment();
    store.replace(chosen.duck, 'load');
    present(chosen.notice);
  });

  // ── Modules ──────────────────────────────────────────────────────────────

  const motionOff = () => prefs.paused || reducedMotion.matches;
  const picker = createPicker(responses);
  createEditor({ store, presets: PRESETS, motionOff });
  createPersonalityPanel({ store });
  createExportPanel({ store, presets: PRESETS });
  const stage = createStage({ store, picker, prefs, reducedMotion });
  const viewer = createViewer({ store });

  // ── Preferences ──────────────────────────────────────────────────────────

  const savePrefs = () => storage.savePrefs(prefs);
  const pressed = (ids, value) => ids.forEach((id) => document.getElementById(id).setAttribute('aria-pressed', String(value)));

  function applyPrefs() {
    if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
    else delete document.documentElement.dataset.theme;
    pressed(['mute', 'viewer-mute'], prefs.muted);
    pressed(['pause', 'viewer-pause'], prefs.paused);
    const toggle = document.getElementById('controls-toggle');
    toggle.setAttribute('aria-expanded', String(!prefs.controlsCollapsed));
    document.getElementById('controls-body').hidden = prefs.controlsCollapsed;
    document.querySelectorAll('.section-toggle').forEach((button) => {
      const body = document.getElementById(button.getAttribute('aria-controls'));
      const collapsed = Boolean(prefs.sectionsCollapsed[body.id]);
      button.setAttribute('aria-expanded', String(!collapsed));
      body.hidden = collapsed;
    });
    stage.refresh();
  }

  const toggle = (key) => () => {
    prefs[key] = !prefs[key];
    savePrefs();
    applyPrefs();
  };
  ['mute', 'viewer-mute'].forEach((id) => document.getElementById(id).addEventListener('click', toggle('muted')));
  ['pause', 'viewer-pause'].forEach((id) => document.getElementById(id).addEventListener('click', toggle('paused')));
  document.getElementById('controls-toggle').addEventListener('click', toggle('controlsCollapsed'));
  document.getElementById('theme').addEventListener('click', () => {
    const current = prefs.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    prefs.theme = current === 'dark' ? 'light' : 'dark';
    savePrefs();
    applyPrefs();
  });
  document.querySelectorAll('.section-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('aria-controls');
      prefs.sectionsCollapsed = { ...prefs.sectionsCollapsed, [id]: !prefs.sectionsCollapsed[id] };
      savePrefs();
      applyPrefs();
    });
  });
  document.getElementById('paste-code').addEventListener('click', () => stage.openPasteDialog());
  reducedMotion.addEventListener('change', () => stage.refresh());

  // ── Maker or view-only ───────────────────────────────────────────────────

  let viewerScale = null;
  function applyMode() {
    const only = viewOnly.matches;
    document.getElementById('maker').hidden = only;
    document.getElementById('viewer').hidden = !only;
    document.getElementById('stage').hidden = only;
    document.body.classList.toggle('view-only', only);
    if (only) {
      viewerScale = viewer.layout();
      stage.setHost(viewer.screen, viewerScale, true);
    } else {
      viewerScale = null;
      stage.setHost(document.getElementById('duck-layer'), shortWindow.matches ? 2 : 3, false);
    }
  }
  viewOnly.addEventListener('change', applyMode);
  shortWindow.addEventListener('change', applyMode);
  // A phone's address bar resizes the window constantly; only a change of
  // laptop scale needs the duck to be re-seated.
  window.addEventListener('resize', () => {
    if (viewOnly.matches && viewer.layout() !== viewerScale) applyMode();
  });
  document.getElementById('skip-to-duck').addEventListener('click', () => document.getElementById('duck').focus());

  document.getElementById('boot-fallback').remove();
  applyMode();
  applyPrefs();
  present(first.notice);
  showRestore();
}

start();
