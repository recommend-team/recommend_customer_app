import { useCallback, useEffect, useState } from 'react';
import {
  isInstalled,
  isIosSafari,
  rememberDismissed,
  wasDismissed,
  type InstallPromptEvent,
} from '../lib/install';

export interface UseInstallPrompt {
  /** 'native' can be installed with one tap; 'ios' can only be talked through it. */
  kind: 'native' | 'ios' | null;
  install: () => void;
  dismiss: () => void;
}

/**
 * Whether — and how — this buyer can put Recommend on their home screen.
 *
 * `kind` is null when there is nothing useful to offer: already installed, previously
 * declined, or a browser that cannot install at all. Callers render nothing in that case
 * rather than showing a button that would do nothing.
 */
export function useInstallPrompt(): UseInstallPrompt {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => wasDismissed());
  const [installed, setInstalled] = useState(() => isInstalled());

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Chrome would otherwise show its own mini-infobar at a moment of its choosing.
      // Holding the event lets us ask once the buyer has seen what the app does.
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };

    // Fires whether they installed from our button or the browser's own menu.
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    if (!deferred) return;

    void deferred.prompt();
    void deferred.userChoice.then(() => {
      // Single-use either way, so the banner goes for now. Notably we do *not* remember
      // a "no" here: backing out of the browser's own dialog is not the same as
      // declining ours. Someone who tapped Add and then mis-tapped, got interrupted, or
      // simply hesitated has shown interest, and holding that against them forever
      // would be the wrong reading. Chrome fires a fresh event on a later visit and the
      // banner comes back with it.
      setDeferred(null);
    });
  }, [deferred]);

  const dismiss = useCallback(() => {
    rememberDismissed();
    setDismissed(true);
  }, []);

  if (installed || dismissed) return { kind: null, install, dismiss };
  if (deferred) return { kind: 'native', install, dismiss };
  if (isIosSafari()) return { kind: 'ios', install, dismiss };

  return { kind: null, install, dismiss };
}
