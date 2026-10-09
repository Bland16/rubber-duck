// The living duck: walking, squeaking, the speech box and the paste-code flow.

import { SIZE } from './duck-format.js';
import { drawSprite, frameAt, MARGIN } from './sprite-render.js';
import { behaviour, isBuddy } from './personality.js';
import { composeHunches, chatterKey, buddyKey, fill } from './response-picker.js';
import { checkCode, guessLanguage, LANGUAGE_ORDER } from './syntax/index.js';
import { squeak } from './audio.js';

export const PROMPT = "You look like you're stuck, paste your code for a check";
const LANGUAGE_LABELS = { java: 'Java', javascript: 'JavaScript', python: 'Python', c: 'C/C++' };
const CONTROL_SELECTOR = 'button, a, input, select, textarea, canvas, label';
const THINKING_MS = 800;

export function createStage({ store, picker, prefs, reducedMotion }) {
  const layer = document.getElementById('duck-layer');
  const duckButton = document.getElementById('duck');
  const canvas = document.getElementById('duck-canvas');
  const controls = document.getElementById('duck-controls');
  const live = document.getElementById('live');
  const speech = document.getElementById('speech');
  const speechText = document.getElementById('speech-text');
  const speechCount = document.getElementById('speech-count');
  const speechAction = document.getElementById('speech-action');
  const speechNext = document.getElementById('speech-next');
  const speechClose = document.getElementById('speech-close');
  const pasteDialog = document.getElementById('paste-dialog');
  const pasteLanguage = document.getElementById('paste-language');
  const pasteText = document.getElementById('paste-text');

  let viewer = false; // view-only mode: the duck lives on the laptop screen
  let host = layer;
  let scale = 3;
  let state = 'idle';
  let stateSince = performance.now();
  let step = 0;
  let lastStepAt = 0;
  let position = { x: 40, y: 0 };
  let target = null;
  let facingLeft = false;
  let lastInput = performance.now();
  let lastSpeechClosed = performance.now();
  let speechOpen = null; // { pages, index, timer, tookFocus }
  let languageTouched = false;

  const duck = () => store.get();
  const motionOff = () => prefs.paused || reducedMotion.matches;
  const side = () => (SIZE + MARGIN * 2) * scale;
  const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));

  // ── Geometry ─────────────────────────────────────────────────────────────

  function bounds() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    const reserved = viewer ? 0 : controls.offsetWidth + 16;
    return { width, height, maxX: Math.max(0, width - reserved - side()), groundY: height - side() - (viewer ? 0 : 8) };
  }

  function place() {
    duckButton.style.transform = `translate(${Math.round(position.x)}px, ${Math.round(position.y)}px)`;
    if (speechOpen) positionSpeech();
  }

  function clampToHost() {
    const b = bounds();
    const roaming = !viewer && duck().roam === 'page' && !motionOff();
    position.x = Math.min(Math.max(0, position.x), roaming ? b.width - side() : b.maxX);
    position.y = roaming ? Math.min(Math.max(0, position.y), b.height - side()) : b.groundY;
    place();
  }

  // A page destination is fine when the duck would not rest on a control.
  function restsOnControl(x, y) {
    const s = side();
    return [...document.querySelectorAll(CONTROL_SELECTOR)].some((node) => {
      if (duckButton.contains(node)) return false;
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return false; // hidden
      return r.left < x + s && r.right > x && r.top < y + s && r.bottom > y;
    });
  }

  const roamingPage = () => !viewer && duck().roam === 'page';
  let lastCrowdCheck = 0;
  // True when a duck resting away from the strip has ended up over a control.
  function onStripOrClear(now) {
    lastCrowdCheck = now;
    return position.y < bounds().groundY - 1 && restsOnControl(position.x, position.y);
  }

  function chooseTarget() {
    const b = bounds();
    if (!viewer && duck().roam === 'page') {
      for (let tries = 0; tries < 10; tries += 1) {
        const x = Math.random() * Math.max(1, b.width - side());
        const y = Math.random() * Math.max(1, b.height - side());
        if (!restsOnControl(x, y)) return { x, y };
      }
    }
    return { x: Math.random() * b.maxX, y: b.groundY };
  }

  // ── State machine ────────────────────────────────────────────────────────

  function enter(next, now = performance.now()) {
    state = next;
    stateSince = now;
    step = 0;
    lastStepAt = now;
  }

  function enterIdle(now = performance.now()) {
    enter('idle', now);
    const { chatterEveryMs } = behaviour(duck().personality);
    if (!motionOff() && chatterEveryMs !== null && now - lastSpeechClosed >= chatterEveryMs
      && !dialogOpen() && !speechOpen) {
      say([chatterLine()]);
    }
  }

  function animationName() {
    if (state === 'walking') return 'walk';
    if (state === 'sleeping') return 'sleep';
    if (state === 'squeaking') return 'squeak';
    if (state === 'thinking') return 'thinking';
    return 'idle';
  }

  function draw() {
    const animation = duck().animations[animationName()];
    const shown = frameAt(animation, step, motionOff());
    drawSprite(canvas, duck(), shown.frame, { scale, flip: facingLeft, dx: shown.dx, dy: shown.dy });
  }

  function tick(now) {
    const b = behaviour(duck().personality);
    const still = motionOff();
    const animation = duck().animations[animationName()];
    if (!still && now - lastStepAt >= 1000 / animation.fps) {
      lastStepAt = now;
      step += 1;
    }

    if (state === 'idle' && !still && !dialogOpen()) {
      // The page can move under a resting duck (a scroll, a section opening).
      const crowded = roamingPage() && now - lastCrowdCheck > 500 && onStripOrClear(now);
      if (now - lastInput > b.sleepAfterMs && !crowded) enter('sleeping', now);
      else if (crowded || now - stateSince > b.idlePauseMs) {
        target = chooseTarget();
        facingLeft = target.x < position.x;
        enter('walking', now);
      }
    } else if (state === 'walking') {
      if (still) {
        clampToHost();
        enterIdle(now);
      } else {
        const dt = Math.min(100, now - (tick.last || now)) / 1000;
        const dx = target.x - position.x;
        const dy = target.y - position.y;
        const distance = Math.hypot(dx, dy);
        const travel = b.walkSpeed * dt;
        if (distance <= travel) {
          position = { ...target };
          enterIdle(now);
        } else {
          position.x += (dx / distance) * travel;
          position.y += (dy / distance) * travel;
        }
        place();
      }
    } else if (state === 'squeaking') {
      const length = (animation.seq.length * 1000) / animation.fps;
      if (now - stateSince >= Math.max(300, length)) {
        if (speechOpen) enter('talking', now);
        else enterIdle(now);
      }
    }

    tick.last = now;
    draw();
    requestAnimationFrame(tick);
  }

  // ── Speech ───────────────────────────────────────────────────────────────

  function positionSpeech() {
    const rect = duckButton.getBoundingClientRect();
    const width = speech.offsetWidth;
    const height = speech.offsetHeight;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    let top = rect.top - height - 10;
    const below = top < 8;
    if (below) top = Math.min(rect.bottom + 10, window.innerHeight - height - 8);
    speech.classList.toggle('speech-below', below);
    speech.style.left = `${Math.max(8, left)}px`;
    speech.style.top = `${Math.max(8, top)}px`;
    const tail = Math.min(Math.max(16, rect.left + rect.width / 2 - Math.max(8, left)), width - 16);
    speech.style.setProperty('--tail', `${tail}px`);
  }

  function showPage() {
    const { pages, index, action } = speechOpen;
    speechText.textContent = pages[index];
    live.textContent = pages[index];
    const more = index < pages.length - 1;
    speechNext.hidden = !more;
    speechCount.hidden = pages.length < 2;
    speechCount.textContent = `${index + 1} of ${pages.length}`;
    speechAction.hidden = !action;
    if (action) speechAction.textContent = action.label;
    positionSpeech();
    clearTimeout(speechOpen.timer);
    if (!action && !more && !prefs.paused) {
      speechOpen.timer = setTimeout(closeSpeech, 4000 + 60 * pages[index].length);
    }
  }

  // pages: the lines to show in order. action: { label, onClick } or null.
  function say(pages, action = null) {
    if (speechOpen) clearTimeout(speechOpen.timer);
    speechOpen = { pages, index: 0, action, timer: null, tookFocus: false };
    speech.hidden = false;
    showPage();
    if (state === 'idle' || state === 'walking' || state === 'sleeping') enter('talking');
    if (action || pages.length > 1) {
      speechOpen.tookFocus = true;
      (action ? speechAction : speechNext).focus();
    }
  }

  function closeSpeech() {
    if (!speechOpen) return;
    clearTimeout(speechOpen.timer);
    const returnFocus = speechOpen.tookFocus && speech.contains(document.activeElement);
    speechOpen = null;
    speech.hidden = true;
    lastSpeechClosed = performance.now();
    if (returnFocus) duckButton.focus();
    if (state === 'talking') enter('idle');
  }

  speechClose.addEventListener('click', closeSpeech);
  speechNext.addEventListener('click', () => {
    speechOpen.index += 1;
    showPage();
    if (speechNext.hidden) speechClose.focus();
  });
  speechAction.addEventListener('click', () => {
    const { action } = speechOpen;
    closeSpeech();
    action.onClick();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && speechOpen && !dialogOpen()) closeSpeech();
  });

  // ── Lines ────────────────────────────────────────────────────────────────

  function chatterLine() {
    const d = duck();
    const aboutCode = !isBuddy(d.personality) && Math.random() < behaviour(d.personality).codeChatterChance;
    return fill(picker.pick(chatterKey(d, aboutCode)), d, '');
  }

  function doSqueak() {
    if (!prefs.muted) squeak();
    enter('squeaking');
    say([chatterLine()]);
    state = 'squeaking';
  }

  function doPrompt() {
    const d = duck();
    if (viewer) {
      doSqueak();
    } else if (isBuddy(d.personality)) {
      say([fill(picker.pick(buddyKey(d)), d, '')]);
    } else {
      say([PROMPT], { label: 'Paste code', onClick: openPasteDialog });
    }
  }

  // ── Paste dialog ─────────────────────────────────────────────────────────

  function offeredLanguages() {
    const chosen = LANGUAGE_ORDER.filter((l) => duck().languages.includes(l));
    return chosen.length ? chosen : LANGUAGE_ORDER;
  }

  function openPasteDialog() {
    if (isBuddy(duck().personality) || pasteDialog.open) return;
    closeSpeech();
    pasteLanguage.replaceChildren(...offeredLanguages().map((l) => {
      const option = document.createElement('option');
      option.value = l;
      option.textContent = LANGUAGE_LABELS[l];
      return option;
    }));
    languageTouched = false;
    pasteText.value = '';
    pasteDialog.returnValue = '';
    pasteDialog.showModal();
    pasteText.focus();
  }

  pasteLanguage.addEventListener('change', () => { languageTouched = true; });
  pasteText.addEventListener('input', () => {
    if (!languageTouched) pasteLanguage.value = guessLanguage(pasteText.value, offeredLanguages());
  });
  pasteDialog.addEventListener('close', () => {
    const text = pasteText.value;
    const language = pasteLanguage.value;
    pasteText.value = '';
    duckButton.focus();
    if (pasteDialog.returnValue !== 'ask') return;
    const result = checkCode(text, language);
    enter('thinking');
    // If the dialog was reopened in the meantime, the answer waits for it.
    const answer = () => {
      if (dialogOpen()) {
        setTimeout(answer, 200);
        return;
      }
      enter('idle');
      say(composeHunches(result, duck(), picker));
    };
    setTimeout(answer, THINKING_MS);
  });

  // ── Input ────────────────────────────────────────────────────────────────

  duckButton.addEventListener('click', (event) => {
    if (event.detail >= 2) {
      if (event.detail === 2) doPrompt();
    } else {
      doSqueak();
    }
  });
  duckButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      doPrompt();
    }
  });

  const noteInput = () => {
    lastInput = performance.now();
    if (state === 'sleeping') enter('idle');
  };
  ['pointerdown', 'pointermove', 'keydown', 'wheel'].forEach((type) => {
    document.addEventListener(type, noteInput, { passive: true });
  });
  window.addEventListener('resize', clampToHost);

  function updateName() {
    const d = duck();
    const name = d.name || 'Duck';
    const enter_ = viewer ? '' : isBuddy(d.personality) ? ', Enter to chat' : ', Enter to paste code';
    duckButton.setAttribute('aria-label', `${name} the duck. Press Space to squeak${enter_}.`);
  }

  store.subscribe(() => {
    updateName();
    if (state !== 'walking') clampToHost();
  });

  // ── Public ───────────────────────────────────────────────────────────────

  requestAnimationFrame(tick);

  return {
    openPasteDialog,
    refresh() {
      updateName();
      clampToHost();
      if (speechOpen) showPage(); // re-arms or cancels the auto-close after a pause change
    },
    // Moves the duck to the fixed page layer (maker) or onto the laptop screen
    // (view-only), at the given pixel scale.
    setHost(element, nextScale, isViewer) {
      host = element;
      scale = nextScale;
      viewer = isViewer;
      if (duckButton.parentElement !== element) element.append(duckButton);
      if (isViewer && pasteDialog.open) pasteDialog.close('cancel');
      closeSpeech();
      enter('idle');
      position.x = Math.min(position.x, bounds().maxX);
      updateName();
      draw();
      clampToHost();
    },
  };
}
