import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCart } from '../../hooks/useCart';
import { formatNaira } from '../../lib/cart/cart';
import type { StorefrontResponse } from '../../lib/contract';
import { Sheet } from '../ui/Sheet';
import { ProductThumb } from '../ui/ProductThumb';
import { DishSheet, isBuildable } from './DishSheet';

type Product = StorefrontResponse['products'][number];

/**
 * A vendor's full menu, opened over the conversation.
 *
 * Adding from here and then opening a different vendor extends the **same** cart — one
 * basket across several vendors, which the backend later splits into one order each.
 *
 * A dish with extras or choices opens to be built as a pack. Extras aren't listed on
 * their own: each dish offers its own.
 */
export function VendorSheet({
  slug,
  fallbackName,
  dishId = null,
  onOpenDish,
  onClose,
  onViewCart,
}: {
  slug: string | null;
  fallbackName: string | null;
  /** The dish being built, over the menu. */
  dishId?: string | null;
  onOpenDish: (productId: string | null) => void;
  onClose: () => void;
  /** Close the menu and open the cart. */
  onViewCart: () => void;
}) {
  const cart = useCart();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', slug],
    queryFn: () => api.getStorefront(slug!),
    enabled: !!slug,
  });

  const vendor = data?.vendor;
  const available = (data?.products ?? []).filter(
    (product) => product.isAvailable !== false,
  );
  const meals = available.filter((product) => !product.isAddOn);
  const dish = meals.find((product) => product.id === dishId) ?? null;
  const name = vendor?.businessName ?? fallbackName ?? 'Vendor';
  const eta = data?.deliveryEtaMinutes;

  const addToCart = (product: Product) =>
    vendor &&
    cart.add({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      imageUrl: product.imageUrl,
      vendorId: vendor.id,
      vendorName: vendor.businessName,
      vendorSlug: vendor.slug,
      isAddOn: !!product.isAddOn,
    });

  const close = () => {
    onOpenDish(null);
    onClose();
  };

  return (
    <>
      <Sheet
        open={!!slug}
        title={name}
        subtitle={
          vendor
            ? [
                vendor.businessCategory,
                vendor.serviceAreas?.map((area) => area.name).join(', '),
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            : undefined
        }
        leading={
          <VendorLogo src={vendor?.businessLogoUrl ?? null} name={name} />
        }
        onClose={close}
        footer={
          cart.itemCount > 0 ? (
            <button
              onClick={onViewCart}
              className="flex h-14 w-full items-center gap-3 rounded-[18px] bg-[var(--color-orange)] pr-2 pl-[18px] text-white shadow-[0_10px_24px_rgba(240,78,35,0.35)] transition active:scale-[0.99]"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[14px] font-bold text-[var(--color-orange-dark)] tabular-nums">
                {cart.itemCount}
              </span>
              <span className="flex-1 text-left text-[16px] font-bold">
                View cart
              </span>
              <span className="flex h-10 items-center rounded-xl bg-black/15 px-3.5 text-[16px] font-bold tabular-nums">
                {formatNaira(cart.goodsTotal)}
              </span>
            </button>
          ) : undefined
        }
      >
        {vendor && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {vendor.isOpen ? (
              <Chip tone="open">
                <span className="h-[7px] w-[7px] rounded-full bg-[#0a8a4a]" />
                Open now
              </Chip>
            ) : (
              <Chip tone="closed">Closed</Chip>
            )}
            {eta !== undefined && (
              <Chip>
                {Math.max(5, eta - 10)}–{eta} min
              </Chip>
            )}
            {!!data?.deliveryFee && (
              <Chip>{formatNaira(data.deliveryFee)} delivery</Chip>
            )}
          </div>
        )}

        {isLoading && <Skeleton />}

        {isError && (
          <p className="py-8 text-center text-[13px] text-[var(--color-ink)]/60">
            Couldn&apos;t load this vendor. Close and try again.
          </p>
        )}

        {!isLoading && !isError && meals.length === 0 && (
          <p className="py-8 text-center text-[13px] text-[var(--color-ink)]/60">
            Nothing available here right now.
          </p>
        )}

        <ul>
          {meals.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              quantity={cart.quantityOf(product.id)}
              buildable={isBuildable(product)}
              onAdd={() =>
                isBuildable(product)
                  ? onOpenDish(product.id)
                  : addToCart(product)
              }
              onChange={(quantity) => cart.setQuantity(product.id, quantity)}
            />
          ))}
        </ul>
      </Sheet>

      {data && (
        <DishSheet
          storefront={data}
          product={dish}
          onClose={() => onOpenDish(null)}
        />
      )}
    </>
  );
}

function ProductRow({
  product,
  quantity,
  buildable,
  onAdd,
  onChange,
}: {
  product: Product;
  quantity: number;
  /** Opens the dish sheet to build a pack, rather than counting. */
  buildable: boolean;
  onAdd: () => void;
  onChange: (quantity: number) => void;
}) {
  return (
    <li className="flex gap-3.5 border-b border-[#f0efea] py-3.5 last:border-b-0">
      <ProductThumb src={product.imageUrl} name={product.name} size={92} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[15px] leading-tight font-bold text-[var(--color-ink)]">
          {product.name}
        </p>
        {product.description && (
          <p className="line-clamp-2 text-[13px] leading-snug text-[var(--color-ink)]/60">
            {product.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="text-[16px] font-bold text-[var(--color-ink)] tabular-nums">
            {formatNaira(product.price)}
            {product.unit && (
              <span className="text-[12px] font-medium text-[var(--color-ink)]/55">
                {' '}
                / {product.unit}
              </span>
            )}
          </span>

          {quantity === 0 || buildable ? (
            <span className="inline-flex shrink-0 items-center gap-2">
              {quantity > 0 && (
                <span className="text-[13px] font-bold text-[var(--color-ink)]/70 tabular-nums">
                  {quantity} in cart
                </span>
              )}
              <button
                onClick={onAdd}
                aria-label={
                  quantity > 0
                    ? `Add another ${product.name}`
                    : `Add ${product.name}`
                }
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border-[1.5px] border-[var(--color-orange)] bg-white px-3.5 text-[14px] font-bold text-[var(--color-orange-dark)] transition active:scale-95"
              >
                <PlusIcon />
                Add
              </button>
            </span>
          ) : (
            <div className="inline-flex h-9 shrink-0 items-center rounded-full bg-[var(--color-orange)] text-white">
              <button
                onClick={() => onChange(quantity - 1)}
                aria-label={
                  quantity === 1
                    ? `Remove ${product.name}`
                    : `One fewer ${product.name}`
                }
                className="grid h-9 w-10 place-items-center"
              >
                <MinusIcon />
              </button>
              <span className="min-w-4 text-center text-[15px] font-bold tabular-nums">
                {quantity}
              </span>
              <button
                onClick={() => onChange(quantity + 1)}
                aria-label={`One more ${product.name}`}
                className="grid h-9 w-10 place-items-center"
              >
                <PlusIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function VendorLogo({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-[#fff1eb] text-[22px] font-bold text-[#b23a12]">
      {src && !failed ? (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </div>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || 'R'
  );
}

function Chip({
  tone = 'plain',
  children,
}: {
  tone?: 'plain' | 'open' | 'closed';
  children: React.ReactNode;
}) {
  const colours = {
    plain: 'bg-[#f4f3ef] font-medium text-[#3b404a]',
    open: 'bg-[#e6f4ec] font-bold text-[#00552d]',
    closed: 'bg-red-50 font-bold text-red-700',
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[12px] ${colours}`}
    >
      {children}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 12h14"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Skeleton() {
  return (
    <ul>
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex gap-3.5 py-3.5">
          <div className="h-[92px] w-[92px] shrink-0 animate-pulse rounded-xl bg-black/5" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-black/5" />
            <div className="h-3 w-full animate-pulse rounded bg-black/5" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-black/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}
