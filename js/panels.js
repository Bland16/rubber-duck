// The Personality and Export panels, and link copying.

import { validateDuck, encodeDuck, LANGUAGES } from './duck-format.js';
import { SLIDER_INFO, traitWords, label, isBuddy } from './personality.js';
import { isEdited } from './editor.js';
import { showNotice, dismissNotice, confirmAction } from './notice.js';
import { slug } from './export/slug.js';
import { sheetBlob, gifBlob, canvasToBlob } from './export/sheet.js';
import { drawCard } from './export/card.js';

const LONG_LINK = 8000;

export async function shareLink(duck) {
  return `${location.origin}${location.pathname}#d=${await encodeDuck(duck)}`;
}

// Copies the duck's link, or shows it selected in `field` when the clipboard
// is not available. Returns the link.
export async function copyLink(duck, fallbackRow, field) {
  const link = await shareLink(duck);
  try {
    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('no clipboard');
    await navigator.clipboard.writeText(link);
    fallbackRow.hidden = true;
    showNotice('Link copied.');
  } catch {
    fallbackRow.hidden = false;
    field.value = link;
    field.focus();
    field.select();
  }
  return link;
}

export function renderTraits(duck, labelEl, chipsEl, badgeEl) {
  labelEl.textContent = label(duck.personality);
  badgeEl.hidden = !isBuddy(duck.personality);
  const words = traitWords(duck.personality);
  if (chipsEl.children.length !== words.length) {
    chipsEl.replaceChildren(...words.map(() => document.createElement('li')));
  }
  words.forEach((word, index) => { chipsEl.children[index].textContent = word; });
}

export function createPersonalityPanel({ store }) {
  const slidersEl = document.getElementById('sliders');
  const languagesEl = document.getElementById('languages');
  const roamEl = document.getElementById('roam');
  const inputs = {};

  SLIDER_INFO.forEach((info) => {
    const id = `slider-${info.key}`;
    const input = Object.assign(document.createElement('input'), { type: 'range', id, min: '0', max: '100', step: '5' });
    const text = Object.assign(document.createElement('label'), { htmlFor: id, textContent: info.label });
    input.addEventListener('input', () => {
      const duck = store.get();
      store.change({ ...duck, personality: { ...duck.personality, [info.key]: Number(input.value) } }, { history: false });
    });
    const row = document.createElement('div');
    row.className = 'slider';
    row.append(text, input);
    slidersEl.append(row);
    inputs[info.key] = input;
  });

  languagesEl.addEventListener('change', () => {
    const chosen = [...languagesEl.querySelectorAll('input:checked')].map((box) => box.value);
    store.change({ ...store.get(), languages: LANGUAGES.filter((l) => chosen.includes(l)) }, { history: false });
  });

  roamEl.addEventListener('change', () => {
    const value = roamEl.querySelector('input:checked').value;
    store.change({ ...store.get(), roam: value }, { history: false });
  });

  function render() {
    const duck = store.get();
    const words = traitWords(duck.personality);
    SLIDER_INFO.forEach((info, index) => {
      const value = String(duck.personality[info.key]);
      if (inputs[info.key].value !== value) inputs[info.key].value = value;
      inputs[info.key].setAttribute('aria-valuetext', `${value}, ${words[index]}`);
    });
    renderTraits(duck, document.getElementById('personality-label'),
      document.getElementById('trait-chips'), document.getElementById('buddy-badge'));
    const buddy = isBuddy(duck.personality);
    languagesEl.disabled = buddy;
    languagesEl.querySelectorAll('input').forEach((box) => { box.checked = duck.languages.includes(box.value); });
    roamEl.querySelectorAll('input').forEach((radio) => { radio.checked = radio.value === duck.roam; });
    document.getElementById('paste-code').hidden = buddy;
  }

  store.subscribe(render);
  render();
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createExportPanel({ store, presets }) {
  const fallbackRow = document.getElementById('link-fallback');
  const field = document.getElementById('link-field');
  const note = document.getElementById('link-note');
  const fileInput = document.getElementById('import-file');

  // Runs one export and reports a failure without breaking the page.
  const guarded = (what, fn) => async () => {
    try {
      await fn(store.get());
    } catch {
      showNotice(`The ${what} could not be made.`, { error: true });
    }
  };

  document.getElementById('export-sheet').addEventListener('click', guarded('sprite sheet', async (duck) => {
    const scale = Number(document.getElementById('sheet-scale').value);
    download(await sheetBlob(duck, scale), `${slug(duck.name)}-sheet.png`);
  }));

  document.getElementById('export-gif').addEventListener('click', guarded('GIF', async (duck) => {
    const animation = document.getElementById('gif-animation').value;
    const scale = Number(document.getElementById('gif-scale').value);
    download(gifBlob(duck, animation, scale), `${slug(duck.name)}-${animation}.gif`);
  }));

  document.getElementById('export-card').addEventListener('click', guarded('share card', async (duck) => {
    const canvas = document.createElement('canvas');
    drawCard(canvas, duck);
    download(await canvasToBlob(canvas), `${slug(duck.name)}-card.png`);
  }));

  document.getElementById('export-file').addEventListener('click', guarded('duck file', async (duck) => {
    download(new Blob([JSON.stringify(duck, null, 2)], { type: 'application/json' }), `${slug(duck.name)}.duck.json`);
  }));

  document.getElementById('copy-link').addEventListener('click', guarded('link', async (duck) => {
    const link = await copyLink(duck, fallbackRow, field);
    note.hidden = link.length <= LONG_LINK;
  }));

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const refuse = (reason) => showNotice(`That file is not a duck this version can open (${reason}).`, { error: true });
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      refuse('not-json');
      return;
    }
    const result = validateDuck(parsed);
    if (!result.ok) {
      refuse(result.reason);
      return;
    }
    if (isEdited(store.get(), presets)
      && !(await confirmAction('Load this duck file? It replaces your whole duck, including its name, personality and languages.', 'Load'))) return;
    dismissNotice(); // an earlier refusal no longer applies
    store.replace(result.duck);
  });
}
