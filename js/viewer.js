// View-only mode: a pixel laptop with the duck walking across its screen.

import { renderTraits, copyLink } from './panels.js';

// The laptop in art pixels.
const ART = { width: 100, height: 70, screen: { x: 10, y: 4, width: 80, height: 50 } };

export function createViewer({ store }) {
  const laptop = document.getElementById('laptop');
  const canvas = document.getElementById('laptop-canvas');
  const screen = document.getElementById('laptop-screen');

  // Sizes the laptop in whole multiples of an art pixel and returns that scale.
  function layout() {
    const available = Math.min(document.documentElement.clientWidth - 32, 600);
    const tall = Math.floor((window.innerHeight - 40) / ART.height); // keep it on a sideways phone's screen
    const k = Math.max(2, Math.min(Math.floor(available / ART.width), tall));
    canvas.width = ART.width * k;
    canvas.height = ART.height * k;
    laptop.style.width = `${canvas.width}px`;
    laptop.style.height = `${canvas.height}px`;
    const ctx = canvas.getContext('2d');
    const rect = (colour, x, y, w, h) => {
      ctx.fillStyle = colour;
      ctx.fillRect(x * k, y * k, w * k, h * k);
    };
    rect('#2b2b33', 6, 0, 88, 58); // bezel
    rect('#9fd3e6', ART.screen.x, ART.screen.y, ART.screen.width, ART.screen.height);
    rect('#8a8d99', 0, 58, 100, 3); // hinge
    rect('#c9ccd6', 0, 61, 100, 9); // base
    rect('#a7aab6', 36, 63, 28, 5); // trackpad
    Object.assign(screen.style, {
      left: `${ART.screen.x * k}px`,
      top: `${ART.screen.y * k}px`,
      width: `${ART.screen.width * k}px`,
      height: `${ART.screen.height * k}px`,
    });
    return k;
  }

  function render() {
    const duck = store.get();
    document.getElementById('viewer-name').textContent = duck.name || 'Duck';
    renderTraits(duck, document.getElementById('viewer-label'),
      document.getElementById('viewer-chips'), document.getElementById('viewer-buddy'));
  }

  document.getElementById('viewer-copy').addEventListener('click', () => {
    copyLink(store.get(), document.getElementById('viewer-link-fallback'), document.getElementById('viewer-link-field'));
  });

  store.subscribe(render);
  render();
  return { layout, screen };
}
