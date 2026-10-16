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
 * - **iOS** fires nothing and offers no API in any browser. The only route is Share →
 *   Add to Home Screen, so the best we can do is say where Share is, at a moment it
 *   makes sense.
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
 * Which kind of iOS browser this is, or null off iOS.
 *
 * Installing is a manual Share → Add to Home Screen gesture everywhere on iOS, and only
 * where Share lives differs:
 *
 * - `safari` — Share in Safari's toolbar (behind ••• in the compact layout).
 * - `other` — Chrome, Edge, Firefox. Since iOS 16.4 they offer Add to Home Screen from
 *   their own Share, and the result is a real web app that can receive push.
 * - `in-app` — the browser inside Instagram, Facebook, TikTok and the like. No Add to
 *   Home Screen at all; the page has to be opened in Safari first.
 *
 * In-app is checked first: those agents can carry other browsers' tokens too. An in-app
 * browser that reports itself as plain Safari (SFSafariViewController) cannot be told
 * apart and is treated as Safari — its toolbar has an Open in Safari button nearby.
 */
export type IosBrowser = 'safari' | 'other' | 'in-app';

const IN_APP_BROWSER =
  /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|TikTok|musical_ly|BytedanceWebview|Twitter|Line\/|GSA\//;
const OTHER_IOS_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//;

export function iosBrowser(): IosBrowser | null {
  if (!isIos()) return null;
  const ua = navigator.userAgent;
  if (IN_APP_BROWSER.test(ua)) return 'in-app';
  if (OTHER_IOS_BROWSER.test(ua)) return 'other';
  return 'safari';
}

/** Any iOS browser — where push waits until the app is on the Home Screen. */
export function isIos(): boolean {
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
 * Install app in the Settings sheet, which ignores this.
 */
export function rememberDismissed(): void {
  safeStorage()?.setItem(DISMISSED_KEY, '1');
}

// ─── The browser's install offer, shared ────────────────────────────────────────────
//
// Chrome fires `beforeinstallprompt` once per page load, and its `prompt()` works once.
// The banner and the Settings sheet both offer to install, so the event lives here, in one
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
 * How this browser installs, for the Settings sheet — which, unlike the banner, always
 * offers it.
 *
 * - `installed`: running from the home screen already.
 * - `native`: Chrome has made an offer; one tap.
 * - `ios-safari`: Share, then Add to Home Screen.
 * - `ios-other`: Chrome, Edge or Firefox on an iPhone — their own Share, then Add to
 *   Home Screen.
 * - `ios-in-app`: a social app's built-in browser, which cannot install — Safari can.
 * - `browser-menu`: no offer to replay (Chrome holding back, Samsung Internet, desktop
 *   Firefox…). The browser's own menu is the way.
 */
export type InstallRoute =
  | 'installed'
  | 'native'
  | 'ios-safari'
  | 'ios-other'
  | 'ios-in-app'
  | 'browser-menu';

export function installRoute(state: InstallSnapshot): InstallRoute {
  if (state.installed) return 'installed';
  if (state.deferred) return 'native';
  const ios = iosBrowser();
  if (ios === 'safari') return 'ios-safari';
  if (ios === 'other') return 'ios-other';
  if (ios === 'in-app') return 'ios-in-app';
  return 'browser-menu';
}
