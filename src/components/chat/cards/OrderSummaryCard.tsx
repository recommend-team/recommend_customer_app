import { formatNaira } from '../../../lib/cart/cart';
import type { OrderSummaryData } from '../../../lib/contract';

/**
 * The order read back — before paying, and again after.
 */
export function OrderSummaryCard({
  data,
  actionable,
  onConfirm,
  onCancel,
}: {
  data: OrderSummaryData;
  actionable: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const paid = data.status === 'PAID';

  const groups = paid
    ? (data.vendors ?? []).map((vendor) => ({
        key: vendor.orderId,
        vendorName: vendor.vendorName ?? null,
        subtotal: vendor.subtotal,
        items: vendor.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
      }))
    : groupByVendor(data.items ?? []);

  return (
    <div className="mt-2 w-full max-w-[92%] overflow-hidden rounded-2xl bg-white shadow-sm">
      <header
        className={`flex items-center gap-2 px-3.5 py-2.5 ${
          paid
            ? 'bg-[var(--color-brand)]/8 text-[var(--color-brand)]'
            : 'border-b border-[var(--color-hairline)] text-[var(--color-ink)]'
        }`}
      >
        {paid && <CheckMark />}
        <p className="flex-1 text-[13px] font-bold">
          {paid ? 'Payment confirmed' : 'Your order'}
        </p>
        {data.reference && (
          <span className="shrink-0 font-mono text-[10px] tracking-tight opacity-60">
            {data.reference}
          </span>
        )}
      </header>

      {groups.map((group) => (
        <section key={group.key}>
          {group.vendorName && (
            <p className="bg-[var(--color-cream)] px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-[var(--color-ink)]/60 uppercase">
              {group.vendorName}
            </p>
          )}

          <ul className="px-3.5">
            {group.items.map((item, index) => (
              <li
                key={`${group.key}-${index}`}
                className="flex items-baseline gap-2 py-1.5 text-[13px]"
              >
                <span className="shrink-0 font-bold text-[var(--color-ink)]/45">
                  {item.quantity}×
                </span>
                <span className="min-w-0 flex-1 text-[var(--color-ink)]">
                  {item.name}
                </span>
                {typeof item.lineTotal === 'number' && (
                  <span className="shrink-0 font-medium text-[var(--color-ink)]">
                    {formatNaira(item.lineTotal)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <dl className="mt-1 space-y-1 border-t border-[var(--color-hairline)] px-3.5 py-2.5 text-[13px]">
        <Row label="Items" value={data.goodsTotal} />
        <Row
          label={
            data.fulfillmentType === 'DELIVERY' ? 'Delivery' : 'Pickup — no fee'
          }
          value={data.deliveryFee}
        />
        <Row label="Total" value={data.totalAmount} strong />
      </dl>

      {(data.deliveryAddress || data.buyerPhone) && (
        <p className="border-t border-[var(--color-hairline)] px-3.5 py-2 text-[12px] leading-relaxed text-[var(--color-ink)]/55">
          {data.fulfillmentType === 'DELIVERY' && data.deliveryAddress
            ? `Delivering to ${data.deliveryAddress}`
            : 'For pickup'}
          {data.buyerPhone ? ` · ${data.buyerPhone}` : ''}
        </p>
      )}

      {!paid && actionable && (
        <div className="flex gap-2 border-t border-[var(--color-hairline)] p-2.5">
          <button
            onClick={onCancel}
            className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-ink)]/55 transition active:opacity-60"
          >
            Change something
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[var(--color-brand)] py-2.5 text-[13px] font-bold text-white transition active:scale-[0.99]"
          >
            Confirm order
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number | undefined;
  strong?: boolean;
}) {
  if (typeof value !== 'number') return null;

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

/** Keep each vendor's items together, in the order they first appear. */
function groupByVendor(items: NonNullable<OrderSummaryData['items']>) {
  const byVendor = new Map<
    string,
    {
      key: string;
      vendorName: string | null;
      subtotal: number | undefined;
      items: { name: string; quantity: number; lineTotal: number }[];
    }
  >();

  for (const item of items) {
    const key = item.vendorName ?? 'unknown';
    const group = byVendor.get(key) ?? {
      key,
      vendorName: item.vendorName,
      subtotal: undefined,
      items: [],
    };
    group.items.push({
      name: item.name,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    });
    byVendor.set(key, group);
  }

  return [...byVendor.values()];
}

function CheckMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.15" />
      <path
        d="M6 10.2 8.7 13 14 7.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
