import { useEffect } from 'react';
import { Sheet } from '../ui/Sheet';
import { useSignIn } from '../../hooks/useSignIn';
import { CheckIcon, CodeStep, EmailStep } from './SignInSteps';

/** How long the "Signed in" confirmation stays before the sheet closes itself. */
const DONE_MS = 1600;


export function SignInSheet({
  open,
  onClose,
  initialEmail = '',
}: {
  open: boolean;
  onClose: () => void;
  initialEmail?: string;
}) {
  return (
    <Sheet
      open={open}
      title={
        initialEmail ? 'Follow your order' : 'Keep your chats on any device'
      }
      subtitle={
        initialEmail
          ? 'Your order is already in your chat.'
          : 'Your chats and orders, on any phone or browser.'
      }
      onClose={onClose}
    >
      {/* Remounted on each open, so it always starts at the email step. */}
      {open && <SignInFlow onClose={onClose} initialEmail={initialEmail} />}
    </Sheet>
  );
}

function SignInFlow({
  onClose,
  initialEmail,
}: {
  onClose: () => void;
  initialEmail: string;
}) {
  const signIn = useSignIn(initialEmail);

  useEffect(() => {
    if (signIn.step !== 'done') return;
    const timer = setTimeout(onClose, DONE_MS);
    return () => clearTimeout(timer);
  }, [signIn.step, onClose]);

  if (signIn.step === 'done') {
    return (
      <div className="flex flex-col items-center gap-2 px-2 pt-4 pb-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
          <CheckIcon />
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

  return (
    <div className="pt-1 pb-4">
      {signIn.step === 'code' ? (
        <CodeStep signIn={signIn} />
      ) : (
        <>
          <EmailStep signIn={signIn} autoFocus />
          <p className="mt-3 text-center text-[12px] text-[var(--color-ink)]/55">
            No password. We&apos;ll email you a 6-digit code.
          </p>
        </>
      )}
    </div>
  );
}
