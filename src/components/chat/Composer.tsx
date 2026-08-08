import { useState } from 'react';

/**
 * The message input: a white pill, with the send button as a separate orange circle —
 * as in the design reference.
 */
export function Composer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <div
      className="flex items-center gap-2 px-3 pt-2"
      // Keeps the composer clear of the home indicator on iOS.
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-sm">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={disabled ? 'Reconnecting…' : 'Type a message…'}
          // A real keyboard "send" key on mobile rather than a newline.
          enterKeyHint="send"
          aria-label="Message"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
        />
      </div>

      <button
        onClick={submit}
        disabled={!canSend}
        aria-label="Send message"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-orange)] text-white shadow-md transition active:scale-95 disabled:opacity-40"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M3.4 20.4 21 12 3.4 3.6l.01 6.53L15 12 3.41 13.87z" />
        </svg>
      </button>
    </div>
  );
}
