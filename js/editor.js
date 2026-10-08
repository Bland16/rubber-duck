// The pixel editor: presets, grid, tools, palette, frame strip and animations.

import {
  SIZE, FRAME_BYTES, MAX_FRAMES, MAX_COLOURS, MAX_SEQ, ANIMATION_NAMES, MOTIONS,
  bytesToFrame, deleteFrame,
} from './duck-format.js';
import { pixelsOf, drawThumb, drawSprite, frameAt } from './sprite-render.js';
import { confirmAction } from './notice.js';

const ANIMATION_LABELS = { idle: 'Idle', walk: 'Walk', squeak: 'Squeak', sleep: 'Sleep', thinking: 'Thinking' };
const artKey = (duck) => JSON.stringify([duck.frames, duck.palette, duck.animations]);

// True when the art differs from every preset.
export function isEdited(duck, presets) {
  const key = artKey(duck);
  return !presets.some((preset) => artKey(preset) === key);
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export function createEditor({ store, presets, motionOff }) {
  const grid = document.getElementById('grid');
  const gridLive = document.getElementById('grid-live');
  const paletteEl = document.getElementById('palette');
  const stripEl = document.getElementById('frame-strip');
  const animationsEl = document.getElementById('animations');
  const nameInput = document.getElementById('duck-name');
  const undoButton = document.getElementById('undo');
  const redoButton = document.getElementById('redo');
  const duplicateButton = document.getElementById('duplicate-frame');
  const deleteButton = document.getElementById('delete-frame');
  const addColourButton = document.getElementById('add-colour');

  let current = 0; // frame being edited
  let colour = 1; // 0 is transparent
  let cursor = { x: 16, y: 16 };
  let stroke = null; // { checkpointed } while the pointer is down
  const wide = window.matchMedia('(min-width: 1024px)');

  const tool = () => document.querySelector('input[name="tool"]:checked').value;
  const duck = () => store.get();

  // ── Presets ──────────────────────────────────────────────────────────────

  const presetRow = document.getElementById('preset-row');
  presets.forEach((preset) => {
    const canvas = el('canvas', { ariaHidden: 'true' });
    const button = el('button', { type: 'button', className: 'preset' }, canvas, el('span', {}, preset.name));
    drawThumb(canvas, preset, preset.animations.idle.seq[0], 2);
    button.addEventListener('click', async () => {
      if (isEdited(duck(), presets)
        && !(await confirmAction(`Replace your drawing with the ${preset.name} duck? Your name and personality are kept.`, 'Replace'))) return;
      current = 0;
      store.replace({
        ...duck(),
        frames: [...preset.frames],
        palette: [...preset.palette],
        animations: JSON.parse(JSON.stringify(preset.animations)),
      });
    });
    presetRow.append(button);
  });

  // ── Name ─────────────────────────────────────────────────────────────────

  nameInput.addEventListener('input', () => {
    store.change({ ...duck(), name: nameInput.value.trim() }, { history: false });
  });

  // ── Grid ─────────────────────────────────────────────────────────────────

  function drawGrid() {
    const side = wide.matches ? 512 : 384;
    if (grid.width !== side) {
      grid.width = side;
      grid.height = side;
    }
    const cell = side / SIZE;
    const ctx = grid.getContext('2d');
    const bytes = pixelsOf(duck().frames[current]);
    const { palette } = duck();
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const value = bytes[y * SIZE + x];
        ctx.fillStyle = value ? palette[value - 1] : ((x + y) % 2 ? '#d9d9d9' : '#f4f4f4');
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < SIZE; i += 1) {
      ctx.moveTo(i * cell + 0.5, 0);
      ctx.lineTo(i * cell + 0.5, side);
      ctx.moveTo(0, i * cell + 0.5);
      ctx.lineTo(side, i * cell + 0.5);
    }
    ctx.stroke();
    if (document.activeElement === grid) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(cursor.x * cell + 1.5, cursor.y * cell + 1.5, cell - 3, cell - 3);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(cursor.x * cell + 3.5, cursor.y * cell + 3.5, cell - 7, cell - 7);
    }
  }

  function writeFrame(bytes, history) {
    const next = { ...duck(), frames: duck().frames.map((f, i) => (i === current ? bytesToFrame(bytes) : f)) };
    store.change(next, { history });
  }

  // Applies the current tool at a cell. `first` is true at the start of a stroke.
  function apply(x, y, first) {
    const bytes = Uint8Array.from(pixelsOf(duck().frames[current]));
    const at = y * SIZE + x;
    const kind = tool();
    if (kind === 'eyedropper') {
      if (first) selectColour(bytes[at]);
      return;
    }
    if (kind === 'fill') {
      if (!first) return;
      const from = bytes[at];
      if (from === colour) return;
      const queue = [at];
      bytes[at] = colour;
      while (queue.length) {
        const p = queue.pop();
        const px = p % SIZE;
        for (const q of [p - SIZE, p + SIZE, px > 0 ? p - 1 : -1, px < SIZE - 1 ? p + 1 : -1]) {
          if (q >= 0 && q < FRAME_BYTES && bytes[q] === from) {
            bytes[q] = colour;
            queue.push(q);
          }
        }
      }
    } else {
      const value = kind === 'eraser' ? 0 : colour;
      if (bytes[at] === value) return;
      bytes[at] = value;
    }
    const history = !stroke || !stroke.checkpointed;
    if (stroke) stroke.checkpointed = true;
    writeFrame(bytes, history);
  }

  const cellAt = (event) => {
    const rect = grid.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * SIZE);
    return { x: Math.min(SIZE - 1, Math.max(0, x)), y: Math.min(SIZE - 1, Math.max(0, y)) };
  };

  grid.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    grid.setPointerCapture(event.pointerId);
    stroke = { checkpointed: false };
    cursor = cellAt(event);
    apply(cursor.x, cursor.y, true);
    drawGrid();
  });
  grid.addEventListener('pointermove', (event) => {
    if (!stroke) return;
    const cell = cellAt(event);
    if (cell.x === cursor.x && cell.y === cursor.y) return;
    cursor = cell;
    apply(cell.x, cell.y, false);
  });
  const endStroke = () => { stroke = null; };
  grid.addEventListener('pointerup', endStroke);
  grid.addEventListener('pointercancel', endStroke);

  function announce() {
    const value = pixelsOf(duck().frames[current])[cursor.y * SIZE + cursor.x];
    gridLive.textContent = `Row ${cursor.y + 1}, column ${cursor.x + 1}, ${value ? `colour ${value}` : 'transparent'}`;
  }

  grid.addEventListener('keydown', (event) => {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) {
      event.preventDefault();
      cursor = {
        x: Math.min(SIZE - 1, Math.max(0, cursor.x + moves[event.key][0])),
        y: Math.min(SIZE - 1, Math.max(0, cursor.y + moves[event.key][1])),
      };
      drawGrid();
      announce();
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      apply(cursor.x, cursor.y, true);
      drawGrid();
      announce();
    }
  });
  grid.addEventListener('focus', () => { drawGrid(); announce(); });
  grid.addEventListener('blur', drawGrid);
  wide.addEventListener('change', drawGrid);

  document.getElementById('clear-frame').addEventListener('click', () => {
    writeFrame(new Uint8Array(FRAME_BYTES), true);
  });

  // ── Undo and redo ────────────────────────────────────────────────────────

  undoButton.addEventListener('click', () => store.undo());
  redoButton.addEventListener('click', () => store.redo());
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text')) return;
    if (document.querySelector('dialog[open]')) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      store.undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      store.redo();
    }
  });

  // ── Palette ──────────────────────────────────────────────────────────────

  function selectColour(value) {
    colour = value;
    renderPalette();
  }

  function renderPalette() {
    const { palette } = duck();
    if (colour > palette.length) colour = palette.length;
    if (paletteEl.children.length !== palette.length + 1) {
      paletteEl.replaceChildren();
      for (let slot = 0; slot <= palette.length; slot += 1) {
        const swatch = el('button', { type: 'button', className: 'swatch' });
        swatch.addEventListener('click', () => selectColour(slot));
        const item = el('div', { className: 'palette-item' }, swatch);
        if (slot === 0) {
          swatch.classList.add('swatch-transparent');
          swatch.setAttribute('aria-label', 'Transparent');
        } else {
          swatch.setAttribute('aria-label', `Colour ${slot}`);
          const picker = el('input', { type: 'color' });
          picker.setAttribute('aria-label', `Change colour ${slot}`);
          let editing = false;
          picker.addEventListener('input', () => {
            const next = { ...duck(), palette: duck().palette.map((c, i) => (i === slot - 1 ? picker.value : c)) };
            store.change(next, { history: !editing });
            editing = true;
          });
          picker.addEventListener('change', () => { editing = false; });
          item.append(picker);
        }
        paletteEl.append(item);
      }
    }
    [...paletteEl.children].forEach((item, slot) => {
      const swatch = item.firstElementChild;
      swatch.setAttribute('aria-pressed', String(slot === colour));
      if (slot > 0) {
        swatch.style.background = palette[slot - 1];
        const picker = item.lastElementChild;
        if (picker.value !== palette[slot - 1]) picker.value = palette[slot - 1];
      }
    });
    addColourButton.disabled = palette.length >= MAX_COLOURS;
  }

  addColourButton.addEventListener('click', () => {
    const next = { ...duck(), palette: [...duck().palette, '#ffffff'] };
    colour = next.palette.length;
    store.change(next);
  });

  // ── Frame strip ──────────────────────────────────────────────────────────

  function renderStrip() {
    const { frames } = duck();
    if (current >= frames.length) current = frames.length - 1;
    if (stripEl.children.length !== frames.length) {
      stripEl.replaceChildren();
      frames.forEach((_, index) => {
        const button = el('button', { type: 'button', className: 'frame' }, el('canvas', { ariaHidden: 'true' }), el('span', {}, String(index + 1)));
        button.setAttribute('aria-label', `Frame ${index + 1}`);
        button.addEventListener('click', () => {
          current = index;
          render();
        });
        stripEl.append(button);
      });
    }
    [...stripEl.children].forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === current));
      drawThumb(button.firstElementChild, duck(), index, 2);
    });
    duplicateButton.disabled = frames.length >= MAX_FRAMES;
    deleteButton.disabled = frames.length <= 1;
  }

  duplicateButton.addEventListener('click', () => {
    const d = duck();
    if (d.frames.length >= MAX_FRAMES) return;
    const next = { ...d, frames: [...d.frames, d.frames[current]] };
    current = next.frames.length - 1;
    store.change(next);
  });

  deleteButton.addEventListener('click', () => {
    if (duck().frames.length <= 1) return;
    const next = deleteFrame(duck(), current);
    current = Math.min(current, next.frames.length - 1);
    store.change(next);
  });

  // ── Animations ───────────────────────────────────────────────────────────

  const animationViews = {};

  function setAnimation(name, patch) {
    const d = duck();
    store.change({ ...d, animations: { ...d.animations, [name]: { ...d.animations[name], ...patch } } });
  }

  ANIMATION_NAMES.forEach((name) => {
    const preview = el('canvas', { className: 'preview', ariaHidden: 'true' });
    const steps = el('div', { className: 'steps' });
    const addStep = el('button', { type: 'button' }, 'Add step');
    const removeStep = el('button', { type: 'button' }, 'Remove step');
    const fps = el('input', { type: 'number', min: '1', max: '12', step: '1', id: `fps-${name}` });
    const motion = el('select', { id: `motion-${name}` }, ...MOTIONS.map((m) => el('option', { value: m }, m[0].toUpperCase() + m.slice(1))));
    const reset = el('button', { type: 'button' }, 'Reset to default');
    reset.setAttribute('aria-label', `Reset ${ANIMATION_LABELS[name]} to default`);
    addStep.setAttribute('aria-label', `Add step to ${ANIMATION_LABELS[name]}`);
    removeStep.setAttribute('aria-label', `Remove step from ${ANIMATION_LABELS[name]}`);

    addStep.addEventListener('click', () => {
      const { seq } = duck().animations[name];
      if (seq.length < MAX_SEQ) setAnimation(name, { seq: [...seq, seq[seq.length - 1]] });
    });
    removeStep.addEventListener('click', () => {
      const { seq } = duck().animations[name];
      if (seq.length > 1) setAnimation(name, { seq: seq.slice(0, -1) });
    });
    fps.addEventListener('change', () => {
      const value = Math.min(12, Math.max(1, Math.round(Number(fps.value) || 1)));
      setAnimation(name, { fps: value });
    });
    motion.addEventListener('change', () => setAnimation(name, { motion: motion.value }));
    reset.addEventListener('click', () => {
      const base = presets[0].animations[name];
      const count = duck().frames.length;
      setAnimation(name, { seq: base.seq.map((i) => (i < count ? i : 0)), fps: base.fps, motion: base.motion });
    });

    const block = el('div', { className: 'animation' },
      el('h3', {}, ANIMATION_LABELS[name]),
      preview,
      el('div', { className: 'animation-controls' },
        el('span', { className: 'steps-label' }, 'Steps'), steps,
        el('div', { className: 'row' }, addStep, removeStep),
        el('div', { className: 'row' },
          el('label', { htmlFor: `fps-${name}` }, 'Frames per second'), fps,
          el('label', { htmlFor: `motion-${name}` }, 'Motion'), motion,
          reset)));
    animationsEl.append(block);
    animationViews[name] = { preview, steps, addStep, removeStep, fps, motion, step: 0, last: 0 };
  });

  function renderAnimations() {
    const d = duck();
    ANIMATION_NAMES.forEach((name) => {
      const view = animationViews[name];
      const animation = d.animations[name];
      if (view.steps.children.length !== animation.seq.length) {
        view.steps.replaceChildren();
        animation.seq.forEach((_, stepIndex) => {
          const select = el('select');
          select.setAttribute('aria-label', `${ANIMATION_LABELS[name]} step ${stepIndex + 1} frame`);
          select.addEventListener('change', () => {
            const seq = [...duck().animations[name].seq];
            seq[stepIndex] = Number(select.value);
            setAnimation(name, { seq });
          });
          view.steps.append(el('div', { className: 'step' }, el('canvas', { ariaHidden: 'true' }), select));
        });
      }
      [...view.steps.children].forEach((step, stepIndex) => {
        const select = step.lastElementChild;
        if (select.options.length !== d.frames.length) {
          select.replaceChildren(...d.frames.map((_, i) => el('option', { value: String(i) }, `Frame ${i + 1}`)));
        }
        select.value = String(animation.seq[stepIndex]);
        drawThumb(step.firstElementChild, d, animation.seq[stepIndex], 1);
      });
      view.addStep.disabled = animation.seq.length >= MAX_SEQ;
      view.removeStep.disabled = animation.seq.length <= 1;
      if (document.activeElement !== view.fps) view.fps.value = String(animation.fps);
      view.motion.value = animation.motion;
    });
  }

  function tickPreviews(now) {
    const d = duck();
    const still = motionOff();
    ANIMATION_NAMES.forEach((name) => {
      const view = animationViews[name];
      const animation = d.animations[name];
      if (now - view.last >= 1000 / animation.fps) {
        view.last = now;
        view.step += 1;
      }
      const shown = frameAt(animation, view.step, still);
      drawSprite(view.preview, d, shown.frame, { scale: 2, dx: shown.dx, dy: shown.dy });
    });
    requestAnimationFrame(tickPreviews);
  }
  requestAnimationFrame(tickPreviews);

  // ── Render ───────────────────────────────────────────────────────────────

  function render() {
    renderStrip();
    renderPalette();
    drawGrid();
    renderAnimations();
    if (document.activeElement !== nameInput) nameInput.value = duck().name;
    undoButton.disabled = !store.canUndo();
    redoButton.disabled = !store.canRedo();
  }

  store.subscribe(render);
  render();
}
