/**
 * The Recommend chime — two rising notes, synthesised rather than shipped as a file.
 *
 * Synthesised because it is then ours outright: no licence to check and nothing to
 * download. The same notes as the vendor app and the admin panel — keep them in step, so
 * Recommend sounds like one thing. It only plays while the app is in front of someone; a
 * backgrounded phone plays its own notification tone and nothing of ours
 * (`recommend-be` → NOTIFICATIONS_PLAN.md §1).
 *
 * Browsers refuse audio until the person has interacted with the page, so the audio
 * context is created and resumed on the first tap or key press — `armChime` wires that up
 * once, at startup. A chime requested before then is silently skipped; the message is in
 * the chat regardless.
 */

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext ??
    null
  );
}

function unlock(): void {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  context ??= new Ctor();
  if (context.state === 'suspended') void context.resume();
}

/** Listen for the first interaction, which is what permits audio. Safe to call twice. */
export function armChime(): () => void {
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  const onInteract = () => unlock();
  for (const name of events) {
    window.addEventListener(name, onInteract, { passive: true });
  }
  return () => {
    for (const name of events) window.removeEventListener(name, onInteract);
  };
}

/** Two notes, E5 then A5 — short, bright, and clear of kitchen noise. */
const NOTES = [
  { frequency: 659.25, start: 0, length: 0.18 },
  { frequency: 880, start: 0.14, length: 0.32 },
];

const PEAK_GAIN = 0.3;

/** Play the chime. Returns whether it actually played. */
export function playChime(): boolean {
  if (!context || context.state !== 'running') return false;

  const now = context.currentTime;

  for (const note of NOTES) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = note.frequency;

    // A fast attack and an exponential tail: a bell, not a beep.
    const begin = now + note.start;
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, begin + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, begin + note.length);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(begin);
    oscillator.stop(begin + note.length + 0.02);
  }

  return true;
}
