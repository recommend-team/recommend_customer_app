import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  installSnapshot,
  isIosSafari,
  promptInstall,
  rememberDismissed,
  subscribeInstall,
  wasDismissed,
  type InstallSnapshot,
} from '../lib/install';

/** The browser's install offer and whether the app is installed, kept current. */
export function useInstallState(): InstallSnapshot {
  return useSyncExternalStore(
    subscribeInstall,
    installSnapshot,
    installSnapshot,
  );
}

export interface UseInstallPrompt {
  /** 'native' can be installed with one tap; 'ios' can only be talked through it. */
  kind: 'native' | 'ios' | null;
  install: () => void;
  dismiss: () => void;
}

/**
 * Whether — and how — the banner should offer to put Recommend on the home screen.
 *
 * `kind` is null when there is nothing useful to offer: already installed, previously
 * declined, or a browser that cannot install at all. Callers render nothing in that case
 * rather than showing a button that would do nothing. The header menu does not use this:
 * it offers installing always, including after the banner was closed.
 */
export function useInstallPrompt(): UseInstallPrompt {
  const { deferred, installed } = useInstallState();
  const [dismissed, setDismissed] = useState(() => wasDismissed());

  // The offer is spent either way, so the banner goes for now. A "no" in the browser's
  // own dialog is deliberately not remembered: someone who tapped Add and then
  // hesitated has shown interest, and Chrome makes a fresh offer on a later visit.
  const install = useCallback(() => void promptInstall(), []);

  const dismiss = useCallback(() => {
    rememberDismissed();
    setDismissed(true);
  }, []);

  if (installed || dismissed) return { kind: null, install, dismiss };
  if (deferred) return { kind: 'native', install, dismiss };
  if (isIosSafari()) return { kind: 'ios', install, dismiss };

  return { kind: null, install, dismiss };
}
