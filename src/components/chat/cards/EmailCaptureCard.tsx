import { useState } from 'react';
import { useAccount } from '../../../hooks/useAccount';
import { useSignIn } from '../../../hooks/useSignIn';
import { CheckIcon, CodeStep, EmailStep } from '../../account/SignInSteps';
import type { EmailCaptureData } from '../../../lib/contract';

/**
 * "Where should we send your receipt?" — the checkout step after the phone number.
 *
 * Verifying here is signing in, over the same events as the sign-in sheet: the receipt
 * goes to a proven address, and the chat now follows the buyer to any device. The server
 * moves the checkout on by itself once the code is right. Skipping answers the question
 * in the thread, like any other choice.
 *
 * Interactive only while it is the live question — from history it is a record, and
 * says nothing.
 */
export function EmailCaptureCard({
  data,
  active,
  onSkip,
}: {
  data: EmailCaptureData;
  active: boolean;
  onSkip: () => void;
}) {
  const { email: signedInAs } = useAccount();
  const signIn = useSignIn(data.email ?? '');
  const [skipped, setSkipped] = useState(false);

  const verified = signIn.step === 'done' ? signIn.email : signedInAs;

  if (verified) {
    return (
      <div className="mt-1.5 flex max-w-[82%] items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-[13px] shadow-sm">
        <span className="text-[var(--color-brand)]">
          <CheckIcon size={16} />
        </span>
        <span className="min-w-0 text-[var(--color-ink)]/75">
          Receipt goes to{' '}
          <b className="break-all text-[var(--color-ink)]">{verified}</b>
        </span>
      </div>
    );
  }

  if (!active || skipped) return null;

  return (
    <div className="mt-1.5 w-full max-w-[88%] rounded-2xl bg-white p-3 shadow-sm">
      {signIn.step === 'code' ? (
        <CodeStep signIn={signIn} compact />
      ) : (
        <EmailStep signIn={signIn} compact />
      )}

      <button
        type="button"
        onClick={() => {
          setSkipped(true);
          onSkip();
        }}
        className="mt-2.5 w-full text-center text-[13px] font-bold text-[var(--color-ink)]/55 transition active:opacity-60"
      >
        Skip for now
      </button>
    </div>
  );
}
