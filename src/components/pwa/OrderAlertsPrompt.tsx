import { useEffect, useState } from 'react';
import { chatClient } from '../../lib/socket';
import { currentPushState, subscribeBrowser } from '../../lib/push';
import { isInstalled, isIosSafari } from '../../lib/install';
import { ShareGlyph } from './InstallPrompt';

const DISMISSED_KEY = 'recommend.buyer.orderAlertsDismissed';

type Step =
  /** Working out what this device can do. Renders nothing. */
  | 'checking'
  /** An iPhone in Safari: push only reaches a Home Screen app, so that comes first. */
  | 'install-first'
  | 'ask'
  | 'asking'
  | 'on'
  /** Nothing to offer — already on, refused, unsupported or switched off. */
  | 'none';

/**
 * "Want me to tell you when it's on its way?"
 *
 * Asked right after a payment lands, because that is the moment a buyer wants updates
 * and is most likely to say yes — and browsers ask once and remember a refusal for good.
 * On an iPhone in Safari there is nothing to ask yet: web push only reaches an app on the
 * Home Screen, so the prompt explains that step instead.
 */
export function OrderAlertsPrompt({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>('checking');

  useEffect(() => {
    if (!visible) return;
    if (wasDismissed()) {
      setStep('none');
      return;
    }
    if (isIosSafari() && !isInstalled()) {
      setStep('install-first');
      return;
    }

    let cancelled = false;
    void currentPushState().then((state) => {
      if (!cancelled) setStep(state === 'available' ? 'ask' : 'none');
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Confirmed for a moment, then out of the way.
  useEffect(() => {
    if (step !== 'on') return;
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [step, onDone]);

  if (!visible || step === 'checking' || step === 'none') return null;

  const dismiss = () => {
    rememberDismissed();
    onDone();
  };

  const enable = async () => {
    setStep('asking');
    const result = await subscribeBrowser();
    if (result.state === 'granted' && 'subscription' in result) {
      const ok = await chatClient.registerPush(result.subscription);
      setStep(ok ? 'on' : 'ask');
      return;
    }
    // Refused or impossible. Do not ask again — the browser will not either.
    rememberDismissed();
    onDone();
  };

  return (
    <div
      role="status"
      className="mx-3.5 mb-2 flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 shadow-sm"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3a6 6 0 016 6v3.6l1.4 2.6a.8.8 0 01-.7 1.2H5.3a.8.8 0 01-.7-1.2L6 12.6V9a6 6 0 016-6z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9.8 19a2.3 2.3 0 004.4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-[var(--color-ink)]">
          {step === 'on'
            ? "Done — we'll let you know."
            : "Want me to tell you when it's on its way?"}
        </p>
        {step === 'install-first' && (
          <p className="text-[12px] leading-snug text-[var(--color-ink)]/55">
            On iPhone, add Recommend to your Home Screen first: tap{' '}
            <ShareGlyph />, then <b>Add to Home Screen</b>.
          </p>
        )}
        {(step === 'ask' || step === 'asking') && (
          <p className="text-[12px] leading-snug text-[var(--color-ink)]/55">
            Even when the app is closed.
          </p>
        )}
      </div>

      {(step === 'ask' || step === 'asking') && (
        <button
          onClick={() => void enable()}
          disabled={step === 'asking'}
          className="shrink-0 rounded-xl bg-[var(--color-brand)] px-3 py-2 text-[12px] font-bold text-white transition active:scale-95 disabled:opacity-60"
        >
          {step === 'asking' ? '…' : 'Yes'}
        </button>
      )}

      {step !== 'on' && (
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
      )}
    </div>
  );
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Permanent, like the install prompt's: asking again every order teaches distrust. */
function rememberDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // Private mode. The prompt will simply come back next time.
  }
}
