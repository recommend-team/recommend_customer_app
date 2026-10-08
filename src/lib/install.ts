/**
 * Getting Recommend onto a home screen.
 *
 * This matters more here than it does for most web apps. A PWA cannot send a
 * notification until it is installed, and on iOS it cannot even ask until the buyer has
 * added it to their home screen by hand. An uninstalled app is one the buyer has to
 * remember to come back to — which was the whole advantage WhatsApp had.
 *
 * The two platforms need entirely different handling:
 *
 * - **Chrome/Android** fires `beforeinstallprompt`, which can be captured and replayed
 *   later against a tap of our own.
 * - **iOS Safari** fires nothing and offers no API at all. The only route is Share →
 *   Add to Home Screen, so the best we can do is say so, at a moment it makes sense.
 *
 * Storage-only and framework-agnostic, like everything else in `lib/`.
 */

const DISMISSED_KEY = 'recommend.install.dismissed';

/** Private mode throws on localStorage rather than returning null. */
function safeStorage(): Storage | null {
  try {
    const probe = '__recommend_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Chrome's deferred prompt. Not in TypeScript's DOM lib — it is not a standard. */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** True once the app is running from the home screen rather than a browser tab. */
export function isInstalled(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS predates the display-mode media query and uses its own flag.
  return (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * iOS Safari, where installing is a manual gesture we can only describe.
 *
 * Chrome and Firefox on iOS are also WebKit, but they cannot install at all — telling
 * their users to look for a Share menu that will not work would be worse than silence.
 */
export function isIosSafari(): boolean {
  return isIos() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
}

function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function wasDismissed(): boolean {
  return safeStorage()?.getItem(DISMISSED_KEY) === '1';
}

/**
 * Remember a "no".
 *
 * Only for an explicit dismissal of our own banner — never for backing out of the
 * browser's install dialog, which is a hesitation rather than a refusal.
 *
 * Permanent rather than a cooling-off period: someone who declined once and is asked
 * again every week learns to distrust the app. Anyone who changes their mind still has
 * Install app in the header menu, which ignores this.
 */
export function rememberDismissed(): void {
  safeStorage()?.setItem(DISMISSED_KEY, '1');
}

// ─── The browser's install offer, shared ────────────────────────────────────────────
//
// Chrome fires `beforeinstallprompt` once per page load, and its `prompt()` works once.
// The banner and the header menu both offer to install, so the event lives here, in one
// place, rather than in each component — whichever is tapped uses it, and the other
// sees that it has gone. Listening starts as this module loads, before any component
// mounts, so an early event is not missed.

export interface InstallSnapshot {
  /** Chrome's held offer, if it has made one and it is unused. */
  deferred: InstallPromptEvent | null;
  installed: boolean;
}

let snapshot: InstallSnapshot = { deferred: null, installed: false };
const listeners = new Set<() => void>();

function update(next: Partial<InstallSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  snapshot = { deferred: null, installed: isInstalled() };

  window.addEventListener('beforeinstallprompt', (event) => {
    // Chrome would otherwise show its own mini-infobar at a moment of its choosing.
    // Holding the event lets us ask once the buyer has seen what the app does.
    event.preventDefault();
    update({ deferred: event as InstallPromptEvent });
  });

  // Fires whether they installed from our button, the menu or the browser's own.
  window.addEventListener('appinstalled', () =>
    update({ installed: true, deferred: null }),
  );
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function installSnapshot(): InstallSnapshot {
  return snapshot;
}

/**
 * Show the browser's install dialog. False when there is no offer to show — the caller
 * explains the manual route instead.
 *
 * The offer is spent either way. Backing out of the dialog is not remembered as a "no":
 * it is hesitation, and Chrome makes a fresh offer on a later visit.
 */
export async function promptInstall(): Promise<boolean> {
  const { deferred } = snapshot;
  if (!deferred) return false;

  update({ deferred: null });
  try {
    await deferred.prompt();
    await deferred.userChoice;
    return true;
  } catch {
    // Already used, or the browser withdrew it.
    return false;
  }
}

/**
 * How this browser installs, for the header menu — which, unlike the banner, always
 * offers it.
 *
 * - `installed`: running from the home screen already.
 * - `native`: Chrome has made an offer; one tap.
 * - `ios-safari`: Share, then Add to Home Screen.
 * - `ios-other`: Chrome or Firefox on an iPhone, which cannot install — Safari can.
 * - `browser-menu`: no offer to replay (Chrome holding back, Samsung Internet, desktop
 *   Firefox…). The browser's own menu is the way.
 */
export type InstallRoute =
  'installed' | 'native' | 'ios-safari' | 'ios-other' | 'browser-menu';

export function installRoute(state: InstallSnapshot): InstallRoute {
  if (state.installed) return 'installed';
  if (state.deferred) return 'native';
  if (isIosSafari()) return 'ios-safari';
  if (isIos()) return 'ios-other';
  return 'browser-menu';
}
