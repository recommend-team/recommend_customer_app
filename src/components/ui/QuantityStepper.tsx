import { formatNaira } from '../../lib/cart/cart';

/**
 * Add / adjust a product's quantity.
 *
 * Collapses to a single "Add" button at zero so a fresh menu is not a wall of steppers,
 * and expands once the item is in the cart.
 */
export function QuantityStepper({
  quantity,
  price,
  onAdd,
  onChange,
}: {
  quantity: number;
  /** Shown on the collapsed button so the buyer sees the cost before committing. */
  price?: number;
  onAdd: () => void;
  onChange: (quantity: number) => void;
}) {
  if (quantity === 0) {
    return (
      <button
        onClick={onAdd}
        className="shrink-0 rounded-full bg-[var(--color-orange)] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm transition active:scale-95"
      >
        {price !== undefined ? `Add · ${formatNaira(price)}` : 'Add'}
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-orange)] p-1 text-white shadow-sm">
      <StepButton
        label={quantity === 1 ? 'Remove' : 'Decrease quantity'}
        onClick={() => onChange(quantity - 1)}
      >
        {quantity === 1 ? (
          <TrashIcon />
        ) : (
          <span className="text-base leading-none">−</span>
        )}
      </StepButton>

      <span className="min-w-5 text-center text-[13px] font-bold tabular-nums">
        {quantity}
      </span>

      <StepButton
        label="Increase quantity"
        onClick={() => onChange(quantity + 1)}
      >
        <span className="text-base leading-none">+</span>
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-6 w-6 place-items-center rounded-full transition active:bg-white/25"
    >
      {children}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9z" />
    </svg>
  );
}
