import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCart } from '../../hooks/useCart';
import { api } from '../../lib/api';
import {
  formatNaira,
  isPack,
  lineTotal,
  packDetails,
  portionPrice,
} from '../../lib/cart/cart';
import type { CartLine } from '../../lib/cart/cart';
import { Sheet } from '../ui/Sheet';
import { QuantityStepper } from '../ui/QuantityStepper';
import { DishSheet } from '../store/DishSheet';

/**
 * The basket, grouped by vendor exactly as the backend will split it — one order per
 * vendor behind a single payment.
 *
 * The total shown is what the client last saw. Checkout recomputes every price from the
 * database, so a stale one is caught there and explained rather than silently charged.
 *
 * A pack shows what's in it and opens to be changed; its stepper counts packs.
 */
export function CartSheet({
  open,
  onClose,
  onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const cart = useCart();
  const groups = cart.groups();
  const [editing, setEditing] = useState<CartLine | null>(null);

  return (
    <>
      <Sheet
        open={open}
        title="Your cart"
        subtitle={
          cart.itemCount > 0
            ? `${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}${
                cart.vendorCount > 1 ? ` from ${cart.vendorCount} vendors` : ''
              }`
            : undefined
        }
        onClose={onClose}
        footer={
          cart.itemCount > 0 ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-[var(--color-ink)]/60">
                  Items
                </span>
                <span className="text-[15px] font-bold text-[var(--color-ink)]">
                  {formatNaira(cart.goodsTotal)}
                </span>
              </div>

              <p className="text-[11px] text-[var(--color-ink)]/45">
                Delivery is added at checkout, once you choose how you want it.
              </p>

              <button
                onClick={onCheckout}
                className="w-full rounded-full bg-[var(--color-orange)] py-3 text-[15px] font-bold text-white shadow-md transition active:scale-[0.99]"
              >
                Checkout
              </button>
            </div>
          ) : undefined
        }
      >
        {cart.removedExtras.length > 0 && (
          <p
            role="status"
            className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-900"
          >
            {listed(cart.removedExtras)}{' '}
            {cart.removedExtras.length === 1 ? 'was' : 'were'} removed — extras
            go with a meal from the same vendor.
          </p>
        )}

        {cart.itemCount === 0 && (
          <p className="py-10 text-center text-[13px] text-[var(--color-ink)]/55">
            Your cart is empty. Ask me for something and I&apos;ll find it.
          </p>
        )}

        <div className="space-y-4 py-1">
          {groups.map((group) => (
            <div key={group.vendorId}>
              <div className="flex items-baseline justify-between">
                <p className="text-[12px] font-bold tracking-wide text-[var(--color-ink)]/70 uppercase">
                  {group.vendorName ?? 'Vendor'}
                </p>
                <span className="text-[12px] text-[var(--color-ink)]/50">
                  {formatNaira(group.subtotal)}
                </span>
              </div>

              <ul className="mt-1 divide-y divide-[var(--color-hairline)]">
                {group.lines.map((line) => (
                  <li key={line.key} className="flex items-start gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] leading-snug text-[var(--color-ink)]">
                        {line.name}
                        {line.isAddOn && (
                          <span className="ml-1.5 rounded-full bg-black/5 px-1.5 py-0.5 align-middle text-[10px] font-bold text-[var(--color-ink)]/55">
                            Extra
                          </span>
                        )}
                      </p>
                      {isPack(line) ? (
                        <>
                          <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-ink)]/60">
                            {packDetails(line).join(' · ')}
                          </p>
                          <p className="mt-0.5 flex items-center gap-2 text-[12px]">
                            <span className="font-bold text-[var(--color-ink)] tabular-nums">
                              {formatNaira(lineTotal(line))}
                            </span>
                            {line.vendorSlug && (
                              <button
                                onClick={() => setEditing(line)}
                                aria-label={`Edit ${line.name}`}
                                className="font-bold text-[var(--color-orange-dark)]"
                              >
                                Edit
                              </button>
                            )}
                          </p>
                        </>
                      ) : (
                        <p className="text-[12px] text-[var(--color-ink)]/55">
                          {formatNaira(portionPrice(line))} each
                        </p>
                      )}
                    </div>

                    <QuantityStepper
                      quantity={line.packs ?? line.quantity}
                      onAdd={() => cart.setCount(line.key, 1)}
                      onChange={(count) => cart.setCount(line.key, count)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Sheet>

      {editing && <EditPack line={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** A pack opened again, against the vendor's menu as it is now. */
function EditPack({ line, onClose }: { line: CartLine; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['storefront', line.vendorSlug],
    queryFn: () => api.getStorefront(line.vendorSlug!),
    enabled: !!line.vendorSlug,
    staleTime: 60_000,
  });
  if (!data) return null;
  return (
    <DishSheet
      storefront={data}
      product={data.products.find((p) => p.id === line.productId) ?? null}
      editing={line}
      onClose={onClose}
    />
  );
}

/** "Bottled water", "Bottled water and Chapman", "A, B and C". */
function listed(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
