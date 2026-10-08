// One synthesised squeak. The audio context is created on the first call, which
// only ever happens inside a click or key press.

let context = null;

export function squeak() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!context) context = new AudioContextClass();
    if (context.state === 'suspended') context.resume();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(900, now);
    oscillator.frequency.linearRampToValueAtTime(1500, now + 0.06);
    oscillator.frequency.linearRampToValueAtTime(700, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch {
    // No sound is fine; the duck carries on.
  }
}
