import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCart } from '../../hooks/useCart';
import { formatNaira } from '../../lib/cart/cart';
import type { StorefrontResponse } from '../../lib/contract';
import { Sheet } from '../ui/Sheet';
import { ProductThumb } from '../ui/ProductThumb';

type Product = StorefrontResponse['products'][number];
type Tab = 'menu' | 'extras';

/**
 * A vendor's full menu, opened over the conversation.
 *
 * Adding from here and then opening a different vendor extends the **same** cart — one
 * basket across several vendors, which the backend later splits into one order each.
 */
export function VendorSheet({
  slug,
  fallbackName,
  onClose,
  onViewCart,
}: {
  slug: string | null;
  fallbackName: string | null;
  onClose: () => void;
  /** Close the menu and open the cart. */
  onViewCart: () => void;
}) {
  const cart = useCart();
  const [tab, setTab] = useState<Tab>('menu');

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
  const extras = available.filter((product) => product.isAddOn);
  // Extras ride with a meal from this kitchen, so they wait for one to be in the cart.
  const hasMeal =
    !!vendor &&
    cart.lines.some((line) => line.vendorId === vendor.id && !line.isAddOn);
  const showing = tab === 'extras' && extras.length > 0 ? 'extras' : 'menu';
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
    setTab('menu');
    onClose();
  };

  return (
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
      leading={<VendorLogo src={vendor?.businessLogoUrl ?? null} name={name} />}
      onClose={close}
      footer={
        cart.itemCount > 0 ? (
          <button
            onClick={() => {
              setTab('menu');
              onViewCart();
            }}
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

      {extras.length > 0 && (
        <div className="sticky top-0 z-10 -mx-4 mt-3 flex gap-2 border-b border-[var(--color-hairline)] bg-white px-4 pb-2.5">
          <TabButton active={showing === 'menu'} onClick={() => setTab('menu')}>
            Menu · {meals.length}
          </TabButton>
          <TabButton
            active={showing === 'extras'}
            onClick={() => setTab('extras')}
          >
            Extras · {extras.length}
          </TabButton>
        </div>
      )}

      {isLoading && <Skeleton />}

      {isError && (
        <p className="py-8 text-center text-[13px] text-[var(--color-ink)]/60">
          Couldn&apos;t load this vendor. Close and try again.
        </p>
      )}

      {!isLoading && !isError && available.length === 0 && (
        <p className="py-8 text-center text-[13px] text-[var(--color-ink)]/60">
          Nothing available here right now.
        </p>
      )}

      {showing === 'extras' && (
        <p className="pt-3 text-[13px] text-[var(--color-ink)]/60">
          {hasMeal
            ? 'Add to go with your meal.'
            : 'Add a meal first — extras go with a meal from this kitchen.'}
        </p>
      )}

      <ul>
        {(showing === 'extras' ? extras : meals).map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            quantity={cart.quantityOf(product.id)}
            locked={!!product.isAddOn && !hasMeal}
            onAdd={() => addToCart(product)}
            onChange={(quantity) => cart.setQuantity(product.id, quantity)}
          />
        ))}
      </ul>
    </Sheet>
  );
}

function ProductRow({
  product,
  quantity,
  locked,
  onAdd,
  onChange,
}: {
  product: Product;
  quantity: number;
  locked: boolean;
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
          </span>

          {quantity === 0 ? (
            <button
              onClick={onAdd}
              disabled={locked}
              aria-label={`Add ${product.name}`}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border-[1.5px] border-[var(--color-orange)] bg-white px-3.5 text-[14px] font-bold text-[var(--color-orange-dark)] transition active:scale-95 disabled:border-black/10 disabled:text-black/30"
            >
              <PlusIcon />
              Add
            </button>
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 rounded-full px-3.5 text-[14px] transition ${
        active
          ? 'bg-[#15171c] font-bold text-white'
          : 'border border-[#dcdbd5] bg-white font-medium text-[#3b404a]'
      }`}
    >
      {children}
    </button>
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
