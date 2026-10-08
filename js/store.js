// Holds the current duck and the undo history. Ducks are treated as immutable:
// every change passes a new object. No DOM.

const LIMIT = 50;
const art = (duck) => ({ frames: duck.frames, palette: duck.palette, animations: duck.animations });

export function createStore(initial) {
  let duck = initial;
  let undoStack = [];
  let redoStack = [];
  const listeners = new Set();
  const emit = (reason) => listeners.forEach((fn) => fn(duck, reason));
  const push = () => {
    undoStack.push(art(duck));
    if (undoStack.length > LIMIT) undoStack.shift();
    redoStack = [];
  };

  return {
    get: () => duck,
    subscribe: (fn) => listeners.add(fn),

    // An edit. history: false for name, personality and languages, and for the
    // later steps of one stroke (after a checkpoint).
    change(next, { history = true } = {}) {
      if (history) push();
      duck = next;
      emit('edit');
    },

    // Marks the state to return to before a multi-step edit such as a stroke.
    checkpoint: push,

    undo() {
      if (!undoStack.length) return;
      redoStack.push(art(duck));
      duck = { ...duck, ...undoStack.pop() };
      emit('edit');
    },

    redo() {
      if (!redoStack.length) return;
      undoStack.push(art(duck));
      duck = { ...duck, ...redoStack.pop() };
      emit('edit');
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    // A whole new duck; the history is emptied. reason 'edit' for a preset or
    // file load, 'load' when the page itself puts a duck on show.
    replace(next, reason = 'edit') {
      duck = next;
      undoStack = [];
      redoStack = [];
      emit(reason);
    },
  };
}
