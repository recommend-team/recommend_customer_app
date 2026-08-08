import { useCart } from '../../hooks/useCart';
import { formatNaira } from '../../lib/cart/cart';
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
          </div>
        ))}
      </div>
    </Sheet>
  );
}
