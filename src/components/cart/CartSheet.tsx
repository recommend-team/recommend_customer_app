import { useQuery } from '@tanstack/react-query';
import { useCart } from '../../hooks/useCart';
import { api } from '../../lib/api';
import { formatNaira } from '../../lib/cart/cart';
import type { CartVendorGroup } from '../../lib/cart/cart';
import { Sheet } from '../ui/Sheet';
import { QuantityStepper } from '../ui/QuantityStepper';

/**
 * The basket, grouped by vendor exactly as the backend will split it — one order per
 * vendor behind a single payment.
 *
 * The total shown is what the client last saw. Checkout recomputes every price from the
 * database, so a stale one is caught there and explained rather than silently charged.
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

  return (
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
          {cart.removedExtras.length === 1 ? 'was' : 'were'} removed — extras go
          with a meal from the same vendor.
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
                <li
                  key={line.productId}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] text-[var(--color-ink)]">
                      {line.name}
                      {line.isAddOn && (
                        <span className="ml-1.5 rounded-full bg-black/5 px-1.5 py-0.5 align-middle text-[10px] font-bold text-[var(--color-ink)]/55">
                          Extra
                        </span>
                      )}
                    </p>
                    <p className="text-[12px] text-[var(--color-ink)]/55">
                      {formatNaira(line.unitPrice)} each
                    </p>
                  </div>

                  <QuantityStepper
                    quantity={line.quantity}
                    onAdd={() => cart.setQuantity(line.productId, 1)}
                    onChange={(quantity) =>
                      cart.setQuantity(line.productId, quantity)
                    }
                  />
                </li>
              ))}
            </ul>

            {open && <AddExtras group={group} />}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/**
 * The vendor's extras not yet in the cart — only once there is a meal from them to go
 * with. Read from the same storefront the vendor menu loads, so it is usually cached.
 */
function AddExtras({ group }: { group: CartVendorGroup }) {
  const cart = useCart();
  const hasMeal = group.lines.some((line) => !line.isAddOn);

  const { data } = useQuery({
    queryKey: ['storefront', group.vendorSlug],
    queryFn: () => api.getStorefront(group.vendorSlug!),
    enabled: hasMeal && !!group.vendorSlug,
    staleTime: 60_000,
  });

  const inCart = new Set(group.lines.map((line) => line.productId));
  const extras = (data?.products ?? []).filter(
    (product) => product.isAddOn && !inCart.has(product.id),
  );
  if (!hasMeal || extras.length === 0) return null;

  return (
    <div className="mt-1 rounded-xl bg-black/[0.03] px-3 py-2">
      <p className="text-[12px] font-bold text-[var(--color-ink)]/65">
        Add extras
      </p>
      <ul className="divide-y divide-[var(--color-hairline)]">
        {extras.map((product) => (
          <li key={product.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-[var(--color-ink)]">
                {product.name}
              </p>
              <p className="text-[12px] text-[var(--color-ink)]/55">
                {formatNaira(product.price)}
              </p>
            </div>
            <QuantityStepper
              quantity={0}
              onAdd={() =>
                cart.add({
                  productId: product.id,
                  name: product.name,
                  unitPrice: product.price,
                  imageUrl: product.imageUrl,
                  vendorId: group.vendorId,
                  vendorName: group.vendorName,
                  vendorSlug: group.vendorSlug,
                  isAddOn: true,
                })
              }
              onChange={() => undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Bottled water", "Bottled water and Chapman", "A, B and C". */
function listed(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
