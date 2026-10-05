/**
 * The Recommend notification sound.
 *
 * Plays `public/sounds/notification.mp3` — replace that file to change the sound, no code
 * involved. The same file sits in all three apps (this one, `recommend_vendors` and
 * `recommend_customer_app`); keep them in step, so Recommend sounds like one thing. If the
 * file is missing or cannot be decoded, a short synthesised two-note chime plays instead.
 *
 * It only plays while the page is in front of someone; otherwise the device plays its own
 * notification tone and nothing of ours (`recommend-be` → NOTIFICATIONS_PLAN.md §1).
 *
 * Browsers refuse audio until the person has interacted with the page. The sound is
 * fetched and decoded at startup, ready, and the audio is unlocked on the first tap, click
 * or key press — `armChime` wires both up. Until then `soundState()` is `locked` and a chime
 * is skipped; `subscribeSound` lets the UI say so instead of failing silently.
 */

const SOUND_URL = '/sounds/notification.mp3';
/** Loud enough to notice across a room, not a jump-scare. */
const VOLUME = 0.8;

type AudioContextCtor = typeof AudioContext;
export type SoundState = 'unsupported' | 'locked' | 'ready';

let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext ??
    null
  );
}

function announce(): void {
  for (const listener of listeners) listener();
}

/** Whether a chime can play right now. */
export function soundState(): SoundState {
  if (!audioContextCtor()) return 'unsupported';
  return context?.state === 'running' ? 'ready' : 'locked';
}

/** Hear `soundState` change — for a "click to allow sound" hint. */
export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function ensureContext(): AudioContext | null {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  if (!context) {
    // Created suspended — allowed before any interaction, and enough to decode into.
    context = new Ctor();
    context.addEventListener('statechange', announce);
  }
  return context;
}

/** Fetch and decode the sound once. A failure leaves the synthesised chime in place. */
function loadSound(): void {
  const ctx = ensureContext();
  if (!ctx || buffer || loading) return;
  loading = fetch(SOUND_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((decoded) => {
      buffer = decoded;
    })
    .catch(() => {
      // Missing or undecodable: keep the fallback, and allow a later retry.
      loading = null;
    });
}

function unlock(): void {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().then(announce, announce);
  loadSound();
}

/**
 * Preload the sound, and unlock audio on the first interaction. Call once at startup;
 * returns a cleanup. The listeners stay for the page's life, so a browser that suspends
 * audio again later is unlocked again by the next click.
 */
export function armChime(): () => void {
  loadSound();
  // Only some events may start audio: on a touch screen it is touchend or click, never
  // touchstart or a touch pointerdown — listening to those alone left phones locked.
  const events = ['pointerdown', 'keydown', 'click', 'touchend'] as const;
  const onInteract = () => unlock();
  for (const name of events) {
    window.addEventListener(name, onInteract, { passive: true });
  }
  announce();
  return () => {
    for (const name of events) window.removeEventListener(name, onInteract);
  };
}

/** Play the notification sound. Returns whether anything played. */
export function playChime(): boolean {
  if (!context || context.state !== 'running') return false;

  if (buffer) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = VOLUME;
    source.connect(gain).connect(context.destination);
    source.start();
    return true;
  }

  playSynthesised(context);
  loadSound();
  return true;
}

/** The fallback: two rising notes, E5 then A5. */
function playSynthesised(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const notes = [
    { frequency: 659.25, start: 0, length: 0.18 },
    { frequency: 880, start: 0.14, length: 0.32 },
  ];

  for (const note of notes) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = note.frequency;

    const begin = now + note.start;
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(0.3, begin + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, begin + note.length);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(begin);
    oscillator.stop(begin + note.length + 0.02);
  }
}
