/**
 * Paystack Inline, loaded only when someone actually pays.
 */

const SCRIPT_URL = 'https://js.paystack.co/v2/inline.js';
const SCRIPT_ID = 'paystack-inline-v2';

/** Only the fragment of Paystack's v2 surface we actually rely on. */
interface PaystackPopup {
  resumeTransaction(
    accessCode: string,
    handlers?: {
      onSuccess?: (payload: { reference?: string }) => void;
      onLoad?: () => void;
      onCancel?: () => void;
      onError?: (error: { message?: string }) => void;
    },
  ): void;
}

declare global {
  interface Window {
    PaystackPop?: new () => PaystackPopup;
  }
}

/** In flight or resolved — a second buyer tap must not fetch the script twice. */
let loading: Promise<boolean> | null = null;

function loadScript(): Promise<boolean> {
  if (window.PaystackPop) return Promise.resolve(true);
  if (loading) return loading;

  loading = new Promise<boolean>((resolve) => {
    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');

    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.addEventListener('load', () => resolve(!!window.PaystackPop));
    // A blocked or offline CDN is not an error the buyer should see — the caller
    // falls back to the redirect URL, which needs no script at all.
    script.addEventListener('error', () => {
      loading = null;
      resolve(false);
    });

    if (!existing) document.head.appendChild(script);
  });

  return loading;
}

export type PaymentOutcome =
  /** Paystack reported the charge succeeded. Still confirmed server-side before it counts. */
  | { result: 'success'; reference: string }
  /** The buyer closed the popup. Nothing was charged. */
  | { result: 'cancelled' }
  /** Inline could not run, so the buyer was sent to Paystack's hosted page instead. */
  | { result: 'redirected' }
  | { result: 'error'; message: string };

/**
 * Open the payment sheet over the conversation, resolving once it closes.
 */
export async function payWithPaystack({
  accessCode,
  publicKey,
  authorizationUrl,
}: {
  accessCode: string;
  publicKey: string | null;
  authorizationUrl: string;
}): Promise<PaymentOutcome> {
  const ready = publicKey ? await loadScript() : false;

  if (!ready || !window.PaystackPop) {
    window.location.assign(authorizationUrl);
    return { result: 'redirected' };
  }

  return new Promise<PaymentOutcome>((resolve) => {
    let settled = false;
    const settle = (outcome: PaymentOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    try {
      new window.PaystackPop!().resumeTransaction(accessCode, {
        onSuccess: (payload) =>
          settle({ result: 'success', reference: payload?.reference ?? '' }),
        onCancel: () => settle({ result: 'cancelled' }),
        onError: (error) =>
          settle({
            result: 'error',
            message: error?.message ?? 'Payment could not be completed.',
          }),
      });
    } catch (error) {
      settle({
        result: 'error',
        message:
          error instanceof Error ? error.message : 'Payment could not start.',
      });
    }
  });
}
