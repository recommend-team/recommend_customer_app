import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * "A new version is ready" — quietly.
 *
 * The service worker is registered with `registerType: 'prompt'`, which means a new
 * build installs but waits rather than seizing the page. Without something to accept
 * that wait, the waiting worker never activates while a tab stays open, and a buyer can
 * sit on a stale shell indefinitely — the config was promising a prompt that did not
 * exist.
 *
 * Deliberately a toast and not a dialog. Applying an update reloads the page, and
 * reloading someone mid-payment to install a service worker would be a poor trade; this
 * waits for a moment they choose. A buyer who ignores it entirely still gets the update
 * on the next cold start, when no tab is holding the old worker open.
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Register now rather than on the window `load` event. This component registers the
    // worker for the whole app, and if `load` has already fired by the time it mounts
    // the listener would never run — no service worker, no offline shell, no install,
    // and nothing to say so.
    immediate: true,
  });

  if (!needRefresh) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[var(--color-ink)] py-2 pr-2 pl-4 text-white shadow-lg">
        <span className="text-[13px]">A new version is ready</span>

        <button
          onClick={() => void updateServiceWorker(true)}
          className="rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-bold transition active:scale-95"
        >
          Reload
        </button>

        <button
          onClick={() => setNeedRefresh(false)}
          aria-label="Dismiss"
          className="grid h-7 w-7 place-items-center rounded-full text-white/60 transition active:opacity-60"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M1 1l10 10M11 1L1 11"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
