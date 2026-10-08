/**
 * Cream header with the wordmark and a connection hint, per the design reference.
 *
 * The connection state is deliberately understated — a buyer does not need to know about
 * websockets, only that a brief wobble is being handled.
 */
export function AppHeader({
  connected,
  onMenu,
}: {
  connected: boolean;
  onMenu: () => void;
}) {
  return (
    <header
      className="flex items-center gap-3 bg-[var(--color-cream)] px-4 pb-3"
      // Clears the notch when installed to the home screen.
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm">
        <img src="/logo-mark.svg" alt="" className="h-5 w-auto" />
      </div>

      <div className="min-w-0">
        <p className="text-[17px] leading-tight font-extrabold text-[var(--color-orange)]">
          Recommend
        </p>
        <p className="text-[10px] font-semibold tracking-widest text-[var(--color-muted)] uppercase">
          {connected ? 'Online' : 'Reconnecting…'}
        </p>
      </div>

      <button
        onClick={onMenu}
        aria-label="Menu"
        aria-haspopup="dialog"
        className="ml-auto grid h-9 w-9 place-items-center rounded-full text-[var(--color-ink)]/50 transition active:bg-black/5"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
    </header>
  );
}
