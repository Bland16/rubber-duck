// Tracing the path the duck walks: a full-window modal dialog the visitor draws on.

const MIN_GAP = 14; // px between kept points
const MIN_LENGTH = 80; // px; shorter than this is treated as a slip
const MAX_POINTS = 400;

// Thins a list of [x, y] points so neighbours are at least `gap` apart.
export function thin(points, gap = MIN_GAP) {
  const out = [];
  points.forEach((p) => {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= gap) out.push(p);
  });
  return out;
}

export function lengthOf(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

// Window pixels -> fractions of the window, or null when the line is too short.
export function toPath(points, width, height) {
  let kept = thin(points);
  if (kept.length < 2 || lengthOf(kept) < MIN_LENGTH) return null;
  while (kept.length > MAX_POINTS) kept = kept.filter((_, i) => i % 2 === 0 || i === kept.length - 1);
  const unit = (n) => Math.min(1, Math.max(0, n));
  return kept.map(([x, y]) => [unit(x / width), unit(y / height)]);
}

// Opens the overlay. Resolves with a path (fractions of the window) or null if cancelled.
export function tracePath() {
  const overlay = document.getElementById('path-overlay');
  const canvas = document.getElementById('path-canvas');
  const help = document.getElementById('path-help-text');
  const cancel = document.getElementById('path-cancel');
  const ctx = canvas.getContext('2d');
  const layer = document.getElementById('duck-layer'); // the duck's own coordinate space
  const returnTo = document.activeElement;
  let points = null;

  help.textContent = 'Press and drag to draw the path your duck walks.';
  overlay.showModal();
  canvas.width = overlay.clientWidth;
  canvas.height = overlay.clientHeight;
  cancel.focus();

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!points || points.length < 2) return;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    [['#000000', 10], ['#f2d50d', 5]].forEach(([colour, width]) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    });
  }

  return new Promise((resolve) => {
    function finish(result) {
      if (overlay.open) overlay.close();
      overlay.removeEventListener('pointerdown', down);
      overlay.removeEventListener('pointermove', move);
      overlay.removeEventListener('pointerup', up);
      overlay.removeEventListener('pointercancel', up);
      overlay.removeEventListener('cancel', stop);
      window.removeEventListener('resize', stop);
      cancel.removeEventListener('click', stop);
      if (returnTo && returnTo.focus) returnTo.focus();
      resolve(result);
    }
    function down(event) {
      if (event.target.closest('.path-help') || event.button !== 0) return;
      overlay.setPointerCapture(event.pointerId);
      points = [[event.clientX, event.clientY]];
    }
    function move(event) {
      if (!points) return;
      points.push([event.clientX, event.clientY]);
      redraw();
    }
    function up() {
      if (!points) return;
      const path = toPath(points, layer.clientWidth, layer.clientHeight);
      points = null;
      if (path) finish(path);
      else {
        help.textContent = 'That was too short. Press and drag a longer line.';
        redraw();
      }
    }
    // Cancel, Escape, or a window that changed size under the drawing.
    function stop() { finish(null); }
    overlay.addEventListener('pointerdown', down);
    overlay.addEventListener('pointermove', move);
    overlay.addEventListener('pointerup', up);
    overlay.addEventListener('pointercancel', up);
    overlay.addEventListener('cancel', stop);
    window.addEventListener('resize', stop);
    cancel.addEventListener('click', stop);
  });
}
