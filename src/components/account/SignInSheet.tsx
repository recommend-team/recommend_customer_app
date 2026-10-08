import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Sheet } from '../ui/Sheet';
import { chatClient } from '../../lib/socket';

type Step = 'email' | 'code' | 'done';

/** How long the "Signed in" confirmation stays before the sheet closes itself. */
const DONE_MS = 1600;

/**
 * "Keep your chats on any device" — sign in with an emailed code.
 *
 * One path for everyone: a returning buyer and a new one both type an email and the code
 * sent to it. No password to make up or forget. Signing in can move this browser onto
 * the conversation the email already has, which the server sends straight back — the
 * thread behind this sheet updates by itself.
 */
export function SignInSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      title="Keep your chats on any device"
      subtitle="Your chats and orders, on any phone or browser."
      onClose={onClose}
    >
      {/* Remounted on each open, so it always starts at the email step. */}
      {open && <SignInFlow onClose={onClose} />}
    </Sheet>
  );
}

function SignInFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      chatClient.onAccountEvents({
        onCodeSent: (sent) => {
          setBusy(false);
          setMessage(null);
          setEmail(sent.email);
          setCode('');
          setResendIn(sent.resendAfter);
          setStep('code');
        },
        onError: (error) => {
          setBusy(false);
          setMessage(error.message);
          // A code went out moments ago and still works — go and enter it.
          if (error.code === 'COOLDOWN') {
            setResendIn(error.retryAfter ?? 30);
            setStep('code');
          }
          if (error.code === 'WRONG_CODE') setCode('');
        },
        onAccount: (signedIn) => {
          if (signedIn) {
            setBusy(false);
            setStep('done');
          }
        },
      }),
    [],
  );

  // The resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus();
    if (step !== 'done') return;
    const timer = setTimeout(onClose, DONE_MS);
    return () => clearTimeout(timer);
  }, [step, onClose]);

  const sendCode = (event?: FormEvent) => {
    event?.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    chatClient.requestSignInCode(email.trim());
  };

  const verify = (value: string) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setMessage(null);
    chatClient.verifySignInCode(email, value);
  };

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-2 px-2 pt-4 pb-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="text-[15px] font-bold text-[var(--color-ink)]">
          Signed in
        </p>
        <p className="text-[13px] text-[var(--color-ink)]/60">
          Your chats will follow you to any device.
        </p>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <div className="flex flex-col gap-3 pt-1 pb-4">
        <p className="text-[13px] leading-snug text-[var(--color-ink)]/70">
          We sent a 6-digit code to{' '}
          <b className="text-[var(--color-ink)]">{email}</b>
        </p>

        <input
          ref={codeInput}
          value={code}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 6);
            setCode(digits);
            // Filled in — by typing or from the keyboard's suggestion — so go.
            if (digits.length === 6) verify(digits);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="6-digit code"
          placeholder="••••••"
          disabled={busy}
          className="w-full rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-cream)] py-3.5 text-center font-mono text-[26px] font-bold tracking-[0.5em] text-[var(--color-ink)] outline-none focus:border-[var(--color-orange)] disabled:opacity-60"
        />

        {message && <Notice>{message}</Notice>}

        <p className="text-[12px] text-[var(--color-ink)]/55">
          Not there? Check Spam or Promotions.
        </p>

        <div className="flex items-center justify-between text-[13px] font-bold">
          <button
            onClick={() => sendCode()}
            disabled={resendIn > 0 || busy}
            className="text-[var(--color-orange)] disabled:text-[var(--color-ink)]/35"
          >
            {resendIn > 0 ? `Resend code (0:${pad(resendIn)})` : 'Resend code'}
          </button>
          <button
            onClick={() => {
              setStep('email');
              setMessage(null);
              setCode('');
            }}
            className="text-[var(--color-ink)]/60"
          >
            Use another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={sendCode} className="flex flex-col gap-3 pt-1 pb-4">
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        inputMode="email"
        autoComplete="email"
        autoFocus
        aria-label="Email address"
        placeholder="you@example.com"
        className="w-full rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-cream)] px-4 py-3.5 text-[15px] text-[var(--color-ink)] outline-none focus:border-[var(--color-orange)]"
      />

      {message && <Notice>{message}</Notice>}

      <button
        type="submit"
        disabled={!email.trim() || busy}
        className="w-full rounded-2xl bg-[var(--color-orange)] py-3.5 text-[15px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Send me a code'}
      </button>

      <p className="text-center text-[12px] text-[var(--color-ink)]/55">
        No password. We&apos;ll email you a 6-digit code.
      </p>
    </form>
  );
}

function Notice({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
    >
      {children}
    </p>
  );
}

function pad(seconds: number): string {
  return String(seconds).padStart(2, '0');
}
