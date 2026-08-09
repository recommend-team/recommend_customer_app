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
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS reports as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIos) return false;

  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
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
 * again every week learns to distrust the app, and the browser's own install button
 * stays available to anyone who changes their mind.
 */
export function rememberDismissed(): void {
  safeStorage()?.setItem(DISMISSED_KEY, '1');
}
