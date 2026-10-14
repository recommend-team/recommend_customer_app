import { useEffect, useMemo, useRef, useState } from 'react';
import type { BuyerOrder } from '../../lib/contract';
import {
  clockTime,
  deliveryTimer,
  trackedOrders,
} from '../../lib/deliveryTimer';

/** Often enough for a bar measured in minutes to look alive. */
const TICK_MS = 15_000;
/** How long "Delivered" shows before the card goes. */
const DELIVERED_MS = 4_000;

/**
 * Pinned above the conversation from payment until the buyer says they have it — so
 * nobody who has paid is left wondering whether anything is happening.
 */
export function DeliveryTimer({
  orders,
  onComplete,
  onOpenOrders,
}: {
  orders: BuyerOrder[];
  onComplete: (reference: string) => void;
  onOpenOrders: () => void;
}) {
  const tracked = useMemo(() => trackedOrders(orders), [orders]);
  const order = tracked[0];

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!order) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [order]);

  // A moment of "Delivered" when one the buyer was watching is received, before it goes.
  const watched = useRef<string[]>([]);
  const [delivered, setDelivered] = useState<string | null>(null);
  useEffect(() => {
    const current = tracked.map((o) => o.reference);
    const finished = watched.current.find(
      (reference) =>
        !current.includes(reference) &&
        orders.find((o) => o.reference === reference)?.status === 'COMPLETED',
    );
    watched.current = current;
    if (!finished) return;

    setDelivered(finished);
    const timer = setTimeout(() => setDelivered(null), DELIVERED_MS);
    return () => clearTimeout(timer);
  }, [tracked, orders]);

  if (!order) {
    if (!delivered) return null;
    return (
      <div
        role="status"
        className="mx-3 mt-2 rounded-2xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/8 px-3.5 py-3 text-center text-[14px] font-bold text-[var(--color-brand)]"
      >
        Delivered ✓ Enjoy!
      </div>
    );
  }

  const timer = deliveryTimer(order, now);
  const more = tracked.length - 1;

  return (
    <section
      aria-label="Your delivery"
      className="mx-3 mt-2 rounded-2xl border border-[var(--color-hairline)] bg-white px-3.5 py-3 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[14px] font-bold text-[var(--color-ink)]">
          {timer.late
            ? 'Almost there — your order is close'
            : 'Your order is coming'}
        </p>
        <p className="shrink-0 text-[12px] text-[var(--color-ink)]/55">
          {timer.late
            ? 'Any moment now'
            : `Around ${clockTime(timer.windowFrom)} – ${clockTime(timer.windowTo)}`}
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="Time since you paid"
        aria-valuemin={0}
        aria-valuemax={timer.totalMinutes}
        aria-valuenow={timer.elapsedMinutes}
        aria-valuetext={`${timer.elapsedMinutes} of about ${timer.totalMinutes} minutes`}
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--color-brand)]/12"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            timer.late ? 'bg-[var(--color-orange)]' : 'bg-[var(--color-brand)]'
          }`}
          style={{ width: `${Math.max(3, timer.progress * 100)}%` }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[11px] text-[var(--color-ink)]/50">
        <span>{timer.elapsedMinutes} min</span>
        <span>~{timer.totalMinutes} min</span>
      </div>

      {order.rider && (
        <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-[var(--color-hairline)] pt-2.5">
          <p className="min-w-0 truncate text-[13px] text-[var(--color-ink)]">
            <span className="text-[var(--color-ink)]/55">Your rider: </span>
            <span className="font-semibold">{order.rider.name}</span>
          </p>
          {order.rider.phone && (
            <a
              href={`tel:${order.rider.phone}`}
              aria-label={`Call ${order.rider.name}`}
              className="shrink-0 rounded-full bg-[var(--color-brand)] px-3 py-1.5 text-[12px] font-bold text-white"
            >
              Call
            </a>
          )}
        </div>
      )}

      {(order.canComplete || more > 0) && (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          {more > 0 ? (
            <button
              onClick={onOpenOrders}
              className="text-[12px] font-semibold text-[var(--color-brand)] underline-offset-2 hover:underline"
            >
              +{more} more {more === 1 ? 'order' : 'orders'}
            </button>
          ) : (
            <span />
          )}
          {order.canComplete && (
            <button
              onClick={() => onComplete(order.reference)}
              className="rounded-full bg-[var(--color-brand)] px-3.5 py-1.5 text-[12px] font-bold text-white transition active:scale-95"
            >
              I&apos;ve received it
            </button>
          )}
        </div>
      )}
    </section>
  );
}
