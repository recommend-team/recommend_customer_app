import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCart } from '../../hooks/useCart';
import { formatNaira } from '../../lib/cart/cart';
import { Sheet } from '../ui/Sheet';
import { QuantityStepper } from '../ui/QuantityStepper';
import { ProductThumb } from '../ui/ProductThumb';

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
}: {
  slug: string | null;
  fallbackName: string | null;
  onClose: () => void;
}) {
  const cart = useCart();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['storefront', slug],
    queryFn: () => api.getStorefront(slug!),
    enabled: !!slug,
  });

  const vendor = data?.vendor;
  const products = (data?.products ?? []).filter((product) => !product.isAddOn);
  const extras = (data?.products ?? []).filter((product) => product.isAddOn);
  // Extras ride with a meal from this kitchen, so they wait for one to be in the cart.
  const hasMeal =
    !!vendor &&
    cart.lines.some((line) => line.vendorId === vendor.id && !line.isAddOn);

  const addToCart = (product: (typeof products)[number], isAddOn: boolean) =>
    vendor &&
    cart.add({
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      imageUrl: product.imageUrl,
      vendorId: vendor.id,
      vendorName: vendor.businessName,
      vendorSlug: vendor.slug,
      isAddOn,
    });

  return (
    <Sheet
      open={!!slug}
      title={vendor?.businessName ?? fallbackName ?? 'Vendor'}
      subtitle={
        vendor
          ? [
              vendor.businessCategory,
              vendor.serviceAreas?.map((area) => area.name).join(', '),
              vendor.isOpen ? 'Open' : 'Closed',
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
      onClose={onClose}
    >
      {isLoading && <Skeleton />}

      {isError && (
        <p className="py-8 text-center text-[13px] text-[var(--color-ink)]/55">
          Couldn&apos;t load this vendor. Close and try again.
        </p>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <p className="py-8 text-center text-[13px] text-[var(--color-ink)]/55">
          Nothing available here right now.
        </p>
      )}

      <ul className="divide-y divide-[var(--color-hairline)]">
        {products.map((product) => (
          <li key={product.id} className="flex items-center gap-3 py-3">
            <ProductThumb
              src={product.imageUrl}
              name={product.name}
              size={64}
            />

            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[var(--color-ink)]">
                {product.name}
              </p>
              {product.description && (
                <p className="line-clamp-2 text-[12px] text-[var(--color-ink)]/55">
                  {product.description}
                </p>
              )}
              <p className="mt-0.5 text-[13px] font-bold text-[var(--color-ink)]">
                {formatNaira(product.price)}
              </p>
            </div>

            <QuantityStepper
              quantity={cart.quantityOf(product.id)}
              onAdd={() => addToCart(product, false)}
              onChange={(quantity) => cart.setQuantity(product.id, quantity)}
            />
          </li>
        ))}
      </ul>

      {extras.length > 0 && (
        <section className="mt-2 border-t border-[var(--color-hairline)] pt-3">
          <p className="text-[12px] font-bold tracking-wide text-[var(--color-ink)]/70 uppercase">
            Extras
          </p>
          <p className="text-[12px] text-[var(--color-ink)]/55">
            {hasMeal
              ? 'Add to go with your meal.'
              : 'Add a meal first — extras go with a meal from this kitchen.'}
          </p>

          <ul className="mt-1 divide-y divide-[var(--color-hairline)]">
            {extras.map((product) => (
              <li key={product.id} className="flex items-center gap-3 py-2.5">
                <ProductThumb
                  src={product.imageUrl}
                  name={product.name}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--color-ink)]">
                    {product.name}
                  </p>
                  <p className="text-[13px] font-bold text-[var(--color-ink)]/80">
                    {formatNaira(product.price)}
                  </p>
                </div>
                {hasMeal ? (
                  <QuantityStepper
                    quantity={cart.quantityOf(product.id)}
                    onAdd={() => addToCart(product, true)}
                    onChange={(quantity) =>
                      cart.setQuantity(product.id, quantity)
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}

function Skeleton() {
  return (
    <ul className="divide-y divide-[var(--color-hairline)]">
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center gap-3 py-3">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-lg bg-black/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-black/5" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-black/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}
