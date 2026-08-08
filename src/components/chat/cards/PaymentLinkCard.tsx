import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { formatNaira } from '../../../lib/cart/cart';
import { payWithPaystack } from '../../../lib/paystack';
import type { PaymentLinkData } from '../../../lib/contract';

/**
 * Pay, without leaving the conversation.
 */

type Phase =
  | 'idle'
  | 'opening'
  | 'confirming'
  | 'paid'
  | 'cancelled'
  | 'failed'
  | 'unconfirmed';

const POLL_INTERVAL_MS = 2500;
const POLL_ATTEMPTS = 20; // ~50s — past that, telling them to wait is more honest.

export function PaymentLinkCard({
  data,
  active,
  settled,
  onPaid,
}: {
  data: PaymentLinkData;
  /**
   * True for the most recent payment card in the thread. Only that one checks the
   * server on mount — an older card re-checking on every history load would be a
   * request per scroll-back for an order already settled.
   */
  active: boolean;
  /** The thread already carries a paid confirmation for this reference. */
  settled: boolean;
  /** Fired once, when this order is known to be paid — the cart is emptied on it. */
  onPaid: (reference: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);

  /** Set on unmount so a poll in flight cannot call setState afterwards. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const markPaid = useCallback(() => {
    setPhase('paid');
    onPaid(data.reference);
  }, [data.reference, onPaid]);

  /**
   * Settle this order, asking Paystack through our server rather than waiting to be told.
   *
   * Retried because a card payment is not always instant — a bank can leave one pending
   * for a few seconds — and because the answer is worth waiting for: without it a buyer
   * who has genuinely paid keeps looking at a Pay button.
   */
  const confirmWithServer = useCallback(
    async (attempts: number): Promise<void> => {
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (!alive.current) return;

        try {
          const status = await api.verifyPayment(data.reference);

          if (!alive.current) return;
          if (status?.status === 'PAID') {
            markPaid();
            return;
          }
        } catch {
          // Offline, or the gateway is unreachable. Keep trying — a failed check says
          // nothing about whether the money moved.
        }

        if (attempt < attempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }

      // Not proven paid, and not proven unpaid either. Say exactly that.
      if (alive.current)
        setPhase((current) =>
          current === 'confirming' ? 'unconfirmed' : current,
        );
    },
    [data.reference, markPaid],
  );

  // The bot has confirmed this order in the thread — believe it over any local state.
  useEffect(() => {
    if (settled) setPhase('paid');
  }, [settled]);

  /**
   * A buyer who paid and then reloaded must not be shown a Pay button again.
   *
   * The cheap read comes first; only an order our own records still call unpaid is worth
   * a round trip to Paystack. That second step is what recovers a payment whose webhook
   * never arrived — otherwise the buyer is stuck looking at a button for money they have
   * already sent.
   */
  useEffect(() => {
    if (!active || settled) return;

    let cancelled = false;

    void (async () => {
      try {
        const status = await api.getOrderStatus(data.reference);
        if (cancelled) return;
        if (status?.status === 'PAID') {
          markPaid();
          return;
        }

        const verified = await api.verifyPayment(data.reference);
        if (cancelled) return;
        if (verified?.status === 'PAID') markPaid();
      } catch {
        // Nothing to say — the card simply stays as it is.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, settled, data.reference, markPaid]);

  const pay = async () => {
    setMessage(null);
    setPhase('opening');

    const outcome = await payWithPaystack({
      accessCode: data.accessCode,
      publicKey: data.publicKey,
      authorizationUrl: data.authorizationUrl,
    });

    if (!alive.current) return;

    switch (outcome.result) {
      case 'success':
        setPhase('confirming');
        void confirmWithServer(POLL_ATTEMPTS);
        break;
      case 'cancelled':
        setPhase('cancelled');
        break;
      case 'redirected':
        // The browser is already navigating to Paystack's hosted page.
        break;
      case 'error':
        setPhase('failed');
        setMessage(outcome.message);
        break;
    }
  };

  if (phase === 'paid') {
    return (
      <Shell tone="paid">
        <p className="text-[13px] font-bold text-[var(--color-brand)]">
          Paid — {formatNaira(data.totalAmount)}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-[var(--color-ink)]/45">
          {data.reference}
        </p>
      </Shell>
    );
  }

  const busy = phase === 'opening' || phase === 'confirming';

  return (
    <Shell tone="plain">
      <dl className="space-y-1 text-[13px]">
        <Line label="Items" value={data.goodsTotal} />
        {data.deliveryFee > 0 && (
          <Line label="Delivery" value={data.deliveryFee} />
        )}
        <Line label="Total" value={data.totalAmount} strong />
      </dl>

      <button
        onClick={pay}
        disabled={busy}
        className="mt-2.5 w-full rounded-xl bg-[var(--color-brand)] py-3 text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
      >
        {phase === 'opening' && 'Opening payment…'}
        {phase === 'confirming' && 'Confirming your payment…'}
        {!busy &&
          (phase === 'idle'
            ? `Pay ${formatNaira(data.totalAmount)}`
            : `Try again — ${formatNaira(data.totalAmount)}`)}
      </button>

      {phase === 'cancelled' && (
        <Note>Payment cancelled. Nothing has been charged.</Note>
      )}

      {phase === 'failed' && (
        <Note>{message ?? 'That payment could not be completed.'}</Note>
      )}

      {phase === 'unconfirmed' && (
        <Note>
          We haven&apos;t had confirmation from the bank yet. If money left your
          account it will land here shortly — don&apos;t pay twice.
        </Note>
      )}

      {phase === 'idle' && (
        <p className="mt-1.5 text-center text-[10px] text-[var(--color-ink)]/40">
          Secured by Paystack · you stay in this chat
        </p>
      )}
    </Shell>
  );
}

function Shell({
  tone,
  children,
}: {
  tone: 'plain' | 'paid';
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-2 w-full max-w-[92%] rounded-2xl p-3.5 shadow-sm ${
        tone === 'paid'
          ? 'bg-[var(--color-brand)]/8 ring-1 ring-[var(--color-brand)]/20'
          : 'bg-white'
      }`}
    >
      {children}
    </div>
  );
}

function Line({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt
        className={
          strong
            ? 'font-bold text-[var(--color-ink)]'
            : 'text-[var(--color-ink)]/55'
        }
      >
        {label}
      </dt>
      <dd
        className={
          strong
            ? 'text-[15px] font-bold text-[var(--color-ink)]'
            : 'text-[var(--color-ink)]/70'
        }
      >
        {formatNaira(value)}
      </dd>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] leading-snug text-amber-900">
      {children}
    </p>
  );
}
