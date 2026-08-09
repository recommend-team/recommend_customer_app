import { useOrders } from '../../hooks/useOrders';
import { formatNaira } from '../../lib/cart/cart';
import { Sheet } from '../ui/Sheet';
import type { BuyerOrder, OrderStatus } from '../../lib/contract';

/**
 * Everything this device has bought.
 */
export function OrdersSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { orders, loading, failed, refresh, complete } = useOrders(open);

  return (
    <Sheet
      open={open}
      title="Your orders"
      subtitle={
        orders.length > 0 ? `${orders.length} on this device` : undefined
      }
      onClose={onClose}
    >
      {loading && orders.length === 0 && (
        <p className="py-8 text-center text-[13px] text-[var(--color-ink)]/55">
          Loading your orders…
        </p>
      )}

      {failed && (
        <div className="py-8 text-center">
          <p className="text-[13px] text-[var(--color-ink)]/55">
            Couldn&apos;t load your orders.
          </p>
          <button
            onClick={refresh}
            className="mt-2 rounded-xl bg-[var(--color-orange)] px-4 py-2 text-[13px] font-bold text-white transition active:scale-95"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !failed && orders.length === 0 && (
        <p className="py-8 text-center text-[13px] leading-relaxed text-[var(--color-ink)]/55">
          No orders yet.
          <br />
          Ask me for anything and I&apos;ll find who has it.
        </p>
      )}

      <ul className="space-y-2.5">
        {orders.map((order) => (
          <OrderCard
            key={order.reference}
            order={order}
            onComplete={() => complete(order.reference)}
          />
        ))}
      </ul>

      {orders.length > 0 && (
        <p className="py-4 text-center text-[11px] leading-relaxed text-[var(--color-ink)]/40">
          These orders live on this device. Clearing your browser will lose
          them.
        </p>
      )}
    </Sheet>
  );
}

function OrderCard({
  order,
  onComplete,
}: {
  order: BuyerOrder;
  onComplete: () => void;
}) {
  const done = order.status === 'COMPLETED';

  return (
    <li className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-[var(--color-hairline)] px-3.5 py-2.5">
        <StatusChip status={order.status} />
        <span className="flex-1 truncate text-right font-mono text-[10px] text-[var(--color-ink)]/40">
          {order.reference}
        </span>
      </header>

      {order.vendors.map((vendor, index) => (
        <section key={`${order.reference}-${index}`} className="px-3.5 py-2">
          {vendor.vendorName && (
            <p className="text-[11px] font-bold tracking-wide text-[var(--color-ink)]/45 uppercase">
              {vendor.vendorName}
            </p>
          )}
          <ul>
            {vendor.items.map((item, itemIndex) => (
              <li
                key={`${order.reference}-${index}-${itemIndex}`}
                className="flex items-baseline gap-2 py-0.5 text-[13px]"
              >
                <span className="shrink-0 font-bold text-[var(--color-ink)]/45">
                  {item.quantity}×
                </span>
                <span className="min-w-0 flex-1 text-[var(--color-ink)]">
                  {item.name}
                </span>
                <span className="shrink-0 text-[var(--color-ink)]/70">
                  {formatNaira(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="flex items-baseline justify-between border-t border-[var(--color-hairline)] px-3.5 py-2.5">
        <span className="text-[12px] text-[var(--color-ink)]/50">
          {new Date(order.createdAt).toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'short',
          })}
          {order.fulfillmentType === 'PICKUP' ? ' · pickup' : ' · delivery'}
        </span>
        <span className="text-[15px] font-bold text-[var(--color-ink)]">
          {formatNaira(order.totalAmount)}
        </span>
      </div>

      {/* Whether this is offered is the server's call, not a guess from the status:
          a pickup order is the buyer's to confirm once ready, a delivery once it has
          left, and only the server knows which rule applies. */}
      {order.canComplete && (
        <button
          onClick={onComplete}
          className="w-full border-t border-[var(--color-hairline)] bg-[var(--color-brand)] py-3 text-[14px] font-bold text-white transition active:scale-[0.99]"
        >
          I&apos;ve received this
        </button>
      )}

      {done && (
        <p className="border-t border-[var(--color-hairline)] py-2.5 text-center text-[12px] font-semibold text-[var(--color-brand)]">
          Received · thank you
        </p>
      )}
    </li>
  );
}

/** Buyer-facing wording. Never the raw enum — "DISPATCHED" is not a thing anyone says. */
const LABELS: Record<OrderStatus, { text: string; tone: string }> = {
  PENDING_PAYMENT: {
    text: 'Not paid',
    tone: 'bg-amber-50 text-amber-800',
  },
  PAID: {
    text: 'Paid',
    tone: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
  },
  READY: {
    text: 'Paid',
    tone: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
  },
  DISPATCHED: { text: 'On its way', tone: 'bg-indigo-50 text-indigo-700' },
  PROCESSING: {
    text: 'In progress',
    tone: 'bg-black/5 text-[var(--color-ink)]/60',
  },
  COMPLETED: {
    text: 'Received',
    tone: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
  },
  CANCELLED: {
    text: 'Cancelled',
    tone: 'bg-black/5 text-[var(--color-ink)]/50',
  },
  REFUNDED: { text: 'Refunded', tone: 'bg-purple-50 text-purple-700' },
};

function StatusChip({ status }: { status: OrderStatus }) {
  const label = LABELS[status] ?? {
    text: status,
    tone: 'bg-black/5 text-[var(--color-ink)]/50',
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${label.tone}`}
    >
      {label.text}
    </span>
  );
}
