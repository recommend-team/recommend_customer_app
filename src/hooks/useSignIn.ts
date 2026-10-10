import { useEffect, useRef, useState, type FormEvent } from 'react';
import { chatClient } from '../lib/socket';

export type SignInStep = 'email' | 'code' | 'done';

export interface UseSignIn {
  step: SignInStep;
  email: string;
  setEmail: (email: string) => void;
  code: string;
  /** Takes whatever was typed; keeps the digits, and submits on the sixth. */
  enterCode: (typed: string) => void;
  busy: boolean;
  /** The server's own words for the last refusal, written for the buyer. */
  message: string | null;
  /** Seconds before another code may be asked for. */
  resendIn: number;
  sendCode: (event?: FormEvent) => void;
  useAnotherEmail: () => void;
}

/**
 * Signing in with an emailed code, as a state machine — shared by the sign-in sheet and
 * the checkout's receipt card, which differ only in how they look.
 *
 * Every instance hears every account event, so each acts only on answers to a request it
 * made itself: a sheet open over a live receipt card must not jump to "enter the code"
 * because the card asked for one.
 */
export function useSignIn(initialEmail = ''): UseSignIn {
  const [step, setStep] = useState<SignInStep>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  /** What this instance is waiting to hear back about. */
  const awaiting = useRef<'code' | 'verify' | null>(null);

  useEffect(
    () =>
      chatClient.onAccountEvents({
        onCodeSent: (sent) => {
          if (awaiting.current !== 'code') return;
          awaiting.current = null;
          setBusy(false);
          setMessage(null);
          setEmail(sent.email);
          setCode('');
          setResendIn(sent.resendAfter);
          setStep('code');
        },
        onError: (error) => {
          if (!awaiting.current) return;
          awaiting.current = null;
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
          if (awaiting.current !== 'verify' || !signedIn) return;
          awaiting.current = null;
          setBusy(false);
          setStep('done');
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

  const sendCode = (event?: FormEvent) => {
    event?.preventDefault();
    if (!email.trim() || busy) return;
    awaiting.current = 'code';
    setBusy(true);
    setMessage(null);
    chatClient.requestSignInCode(email.trim());
  };

  const enterCode = (typed: string) => {
    const digits = typed.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    // Filled in — by typing or from the keyboard's suggestion — so go.
    if (digits.length !== 6 || busy) return;
    awaiting.current = 'verify';
    setBusy(true);
    setMessage(null);
    chatClient.verifySignInCode(email, digits);
  };

  const useAnotherEmail = () => {
    awaiting.current = null;
    setStep('email');
    setMessage(null);
    setCode('');
  };

  return {
    step,
    email,
    setEmail,
    code,
    enterCode,
    busy,
    message,
    resendIn,
    sendCode,
    useAnotherEmail,
  };
}
