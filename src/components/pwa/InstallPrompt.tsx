import { useInstallPrompt } from '../../hooks/useInstallPrompt';

/**
 * "Keep Recommend on your phone."
 *
 * Shown only once the buyer has actually used the chat — asking someone to install an
 * app before they know what it does is how a prompt gets dismissed on reflex.
 *
 * On Android this is one tap. On iOS there is no API at all, so the only honest thing is
 * to describe the gesture: Share, then Add to Home Screen. That is worth saying rather
 * than skipping, because an iOS buyer who never installs can never be sent a
 * notification about their order.
 */
export function InstallPrompt({ visible }: { visible: boolean }) {
  const { kind, install, dismiss } = useInstallPrompt();

  if (!visible || kind === null) return null;

  return (
    <div className="mx-3.5 mb-2 flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 shadow-sm">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-orange)]/10 text-[var(--color-orange)]">
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 2.5v10m0 0 3.5-3.5M10 12.5 6.5 9M3.5 14v2A1.5 1.5 0 0 0 5 17.5h10a1.5 1.5 0 0 0 1.5-1.5v-2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-[var(--color-ink)]">
          Keep Recommend on your phone
        </p>
        <p className="text-[12px] leading-snug text-[var(--color-ink)]/55">
          {kind === 'ios' ? (
            <>
              Tap <ShareGlyph /> below, then <b>Add to Home Screen</b>
            </>
          ) : (
            'Order again without hunting for the link'
          )}
        </p>
      </div>

      {kind === 'native' && (
        <button
          onClick={install}
          className="shrink-0 rounded-xl bg-[var(--color-orange)] px-3 py-2 text-[12px] font-bold text-white transition active:scale-95"
        >
          Add
        </button>
      )}

      <button
        onClick={dismiss}
        aria-label="Not now"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--color-ink)]/35 transition active:opacity-60"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M1 1l10 10M11 1L1 11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/** iOS's share mark, inline in the sentence — the words alone are easy to miss. */
function ShareGlyph() {
  return (
    <svg
      width="11"
      height="13"
      viewBox="0 0 14 17"
      fill="none"
      className="inline-block align-[-1px]"
      aria-label="the Share button"
    >
      <path
        d="M7 1v10M7 1 4.2 3.8M7 1l2.8 2.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 7H2.2A1.2 1.2 0 0 0 1 8.2v6.6A1.2 1.2 0 0 0 2.2 16h9.6a1.2 1.2 0 0 0 1.2-1.2V8.2A1.2 1.2 0 0 0 11.8 7h-1.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
