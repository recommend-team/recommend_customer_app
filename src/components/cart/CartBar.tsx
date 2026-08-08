import { useCart } from '../../hooks/useCart';
import { formatNaira } from '../../lib/cart/cart';

/**
 * The cart's presence in the chat.
 *
 * Sits above the composer only when there is something in it. Without this the cart would
 * be invisible — a buyer adds an item from a sheet, dismisses it, and has no way back.
 */
export function CartBar({ onOpen }: { onOpen: () => void }) {
  const { itemCount, goodsTotal, vendorCount } = useCart();

  if (itemCount === 0) return null;

  return (
    <button
      onClick={onOpen}
      className="mx-3 mb-1 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-full bg-[var(--color-brand)] px-4 py-2.5 text-left text-white shadow-md transition active:scale-[0.99]"
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20 text-[11px] font-bold tabular-nums">
        {itemCount}
      </span>

      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
        {formatNaira(goodsTotal)}
        {vendorCount > 1 && (
          <span className="font-normal text-white/75">
            {' '}
            · {vendorCount} vendors
          </span>
        )}
      </span>

      <span className="shrink-0 text-[13px] font-bold">View cart</span>
    </button>
  );
}
