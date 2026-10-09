import { useState } from 'react';
import type { AddOnOfferData } from '../../../lib/contract';
import { formatNaira } from '../../../lib/cart/cart';
import { QuantityStepper } from '../../ui/QuantityStepper';
import { ProductThumb } from '../../ui/ProductThumb';

/**
 * "Anything to go with it?" — the cart vendors' extras, offered once after Pay.
 *
 * Each vendor's extras sit under its name: an extra is always cooked and delivered with
 * a meal from its own kitchen. The button carries the running total, so the buyer sees
 * what they are adding before they add it. Prices here are for display — the server
 * charges from the database.
 *
 * Interactive only while it is the live question. Once answered, or from history, it
 * stays out of the way: the buyer's own "Add …" line in the thread says what they chose.
 */
export function AddOnOfferCard({
  data,
  active,
  onAnswer,
}: {
  data: AddOnOfferData;
  active: boolean;
  onAnswer: (
    items: { productId: string; quantity: number }[],
    said: string,
  ) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [answered, setAnswered] = useState(false);

  if (!active || answered) return null;

  const items = data.vendors.flatMap((vendor) => vendor.items);
  const picked = items
    .map((item) => ({ item, quantity: quantities[item.productId] ?? 0 }))
    .filter(({ quantity }) => quantity > 0);
  const total = picked.reduce(
    (sum, { item, quantity }) => sum + item.price * quantity,
    0,
  );

  const set = (productId: string, quantity: number) =>
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.min(50, quantity)),
    }));

  const add = () => {
    setAnswered(true);
    onAnswer(
      picked.map(({ item, quantity }) => ({
        productId: item.productId,
        quantity,
      })),
      `Add ${picked
        .map(({ item, quantity }) => `${quantity} × ${item.name}`)
        .join(', ')}`,
    );
  };

  // A no is a no, whatever was tapped up before it.
  const decline = () => {
    setAnswered(true);
    onAnswer([], 'No, thanks');
  };

  return (
    <div className="mt-1.5 w-full max-w-[88%] rounded-2xl bg-white p-3 shadow-sm">
      <div className="space-y-3">
        {data.vendors.map((vendor) => (
          <section key={vendor.vendorId}>
            {data.vendors.length > 1 || vendor.vendorName ? (
              <p className="mb-1 text-[11px] font-bold tracking-wide text-[var(--color-ink)]/55 uppercase">
                From {vendor.vendorName ?? 'this vendor'}
              </p>
            ) : null}

            <ul className="divide-y divide-[var(--color-hairline)]">
              {vendor.items.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center gap-2.5 py-2"
                >
                  <ProductThumb
                    src={item.imageUrl}
                    name={item.name}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-[var(--color-ink)]">
                      {item.name}
                    </p>
                    <p className="text-[12px] font-bold text-[var(--color-ink)]/70">
                      {formatNaira(item.price)}
                    </p>
                  </div>
                  <QuantityStepper
                    quantity={quantities[item.productId] ?? 0}
                    onAdd={() => set(item.productId, 1)}
                    onChange={(quantity) => set(item.productId, quantity)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={add}
          disabled={picked.length === 0}
          className="w-full rounded-xl bg-[var(--color-orange)] py-2.5 text-[14px] font-bold text-white transition active:scale-[0.99] disabled:opacity-45"
        >
          {picked.length > 0
            ? `Add & continue — ${formatNaira(total)}`
            : 'Pick an extra to add'}
        </button>
        <button
          type="button"
          onClick={decline}
          className="w-full py-2 text-[13px] font-bold text-[var(--color-ink)]/55 transition active:opacity-60"
        >
          No, thanks
        </button>
      </div>
    </div>
  );
}
