import { useEffect, useRef } from 'react';
import type { UseSignIn } from '../../hooks/useSignIn';

/**
 * The two steps of signing in, drawn once for both places that offer it: the sign-in
 * sheet and the checkout's receipt card. `compact` is the card's smaller size.
 */

export function EmailStep({
  signIn,
  compact,
  autoFocus,
}: {
  signIn: UseSignIn;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const { email, setEmail, busy, message, sendCode } = signIn;

  return (
    <form
      onSubmit={sendCode}
      className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}
    >
      <div className={compact ? 'flex gap-2' : 'flex flex-col gap-3'}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          inputMode="email"
          autoComplete="email"
          autoFocus={autoFocus}
          aria-label="Email address"
          placeholder="you@example.com"
          className={[
            'w-full min-w-0 border border-[var(--color-hairline)] bg-[var(--color-cream)] text-[var(--color-ink)] outline-none focus:border-[var(--color-orange)]',
            compact
              ? 'rounded-xl px-3 py-2.5 text-[14px]'
              : 'rounded-2xl px-4 py-3.5 text-[15px]',
          ].join(' ')}
        />
        <button
          type="submit"
          disabled={!email.trim() || busy}
          className={[
            'shrink-0 bg-[var(--color-orange)] font-bold text-white transition active:scale-[0.99] disabled:opacity-50',
            compact
              ? 'rounded-xl px-3.5 text-[13px]'
              : 'w-full rounded-2xl py-3.5 text-[15px]',
          ].join(' ')}
        >
          {busy ? 'Sending…' : compact ? 'Send code' : 'Send me a code'}
        </button>
      </div>

      {message && <Notice>{message}</Notice>}
    </form>
  );
}

export function CodeStep({
  signIn,
  compact,
}: {
  signIn: UseSignIn;
  compact?: boolean;
}) {
  const { email, code, enterCode, busy, message, resendIn, sendCode } = signIn;
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  return (
    <div className={compact ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
      <p className="text-[13px] leading-snug text-[var(--color-ink)]/70">
        We sent a 6-digit code to{' '}
        <b className="break-all text-[var(--color-ink)]">{email}</b>
      </p>

      <input
        ref={input}
        value={code}
        onChange={(event) => enterCode(event.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="6-digit code"
        placeholder="••••••"
        disabled={busy}
        className={[
          'w-full border border-[var(--color-hairline)] bg-[var(--color-cream)] text-center font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-orange)] disabled:opacity-60',
          compact
            ? 'rounded-xl py-2.5 text-[20px] tracking-[0.45em]'
            : 'rounded-2xl py-3.5 text-[26px] tracking-[0.5em]',
        ].join(' ')}
      />

      {message && <Notice>{message}</Notice>}

      <p className="text-[12px] text-[var(--color-ink)]/55">
        Not there? Check Spam or Promotions.
      </p>

      <div className="flex items-center justify-between gap-3 text-[13px] font-bold">
        <button
          type="button"
          onClick={() => sendCode()}
          disabled={resendIn > 0 || busy}
          className="text-[var(--color-orange)] disabled:text-[var(--color-ink)]/35"
        >
          {resendIn > 0 ? `Resend code (0:${pad(resendIn)})` : 'Resend code'}
        </button>
        <button
          type="button"
          onClick={signIn.useAnotherEmail}
          className="text-[var(--color-ink)]/60"
        >
          Use another email
        </button>
      </div>
    </div>
  );
}

export function Notice({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
    >
      {children}
    </p>
  );
}

export function CheckIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function pad(seconds: number): string {
  return String(seconds).padStart(2, '0');
}
