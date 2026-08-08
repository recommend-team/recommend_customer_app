import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * A panel that slides up **over** the conversation.
 *
 * This is the mechanism the whole product depends on: menus, the cart and checkout all
 * appear here rather than as routes, so the thread is never navigated away from. It is the
 * WhatsApp in-app browser model — the chat stays put underneath.
 */
export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Escape closes it, and the thread behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[85%] flex-col rounded-t-3xl bg-white shadow-2xl"
      >
        <div className="shrink-0 px-4 pt-3 pb-2">
          {/* Grab handle — signals the panel is dismissible. */}
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10" />

          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-bold text-[var(--color-ink)]">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-0.5 truncate text-[12px] text-[var(--color-ink)]/55">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/5 text-[var(--color-ink)]/60 transition active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          {children}
        </div>

        {footer && (
          <div
            className="shrink-0 border-t border-[var(--color-hairline)] px-4 pt-3"
            style={{
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
