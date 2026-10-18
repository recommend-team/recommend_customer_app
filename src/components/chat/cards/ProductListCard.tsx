import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '../../../hooks/useCart';
import { api } from '../../../lib/api';
import { isBuildable } from '../../store/DishSheet';
import { formatNaira } from '../../../lib/cart/cart';
import { QuantityStepper } from '../../ui/QuantityStepper';
import { ProductThumb } from '../../ui/ProductThumb';
import type { ProductListData } from '../../../lib/contract';

/**
 * What the bot found, grouped by the vendor selling it.
 *
 * **Every price shown here comes from this payload**, which the server built from the
 * database. The assistant is forbidden from putting a price in its text and a guard strips
 * any it tries, so this card is the only place a number reaches the buyer.
 *
 * A dish with extras or choices is built over the vendor's menu rather than added as a
 * count — checkout won't take a dish without its required choice.
 */
export function ProductListCard({
  data,
  onOpenVendor,
}: {
  data: ProductListData;
  onOpenVendor: (slug: string, name: string | null, dishId?: string) => void;
}) {
  const cart = useCart();
  const queryClient = useQueryClient();
  const vendors = data?.vendors ?? [];

  if (vendors.length === 0) return null;

  return (
    <div className="mt-2 w-full max-w-[92%] space-y-2">
      {vendors.map((vendor) => (
        <div
          key={vendor.vendorId}
          className="overflow-hidden rounded-2xl bg-white shadow-sm"
        >
          <div className="flex items-center gap-2 border-b border-[var(--color-hairline)] px-3.5 py-2.5">
            <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--color-ink)]">
              {vendor.vendorName ?? 'Vendor'}
            </p>

            {vendor.vendorSlug && (
              <button
                onClick={() =>
                  onOpenVendor(vendor.vendorSlug!, vendor.vendorName)
                }
                className="shrink-0 text-[12px] font-semibold text-[var(--color-orange)] transition active:opacity-60"
              >
                See all
              </button>
            )}
          </div>

          <ul>
            {vendor.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-3.5 py-2.5 not-last:border-b not-last:border-[var(--color-hairline)]"
              >
                <ProductThumb src={item.imageUrl} name={item.name} size={56} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-[var(--color-ink)]">
                    {item.name}
                  </p>
                  <p className="text-[13px] font-bold text-[var(--color-ink)]">
                    {formatNaira(item.price)}
                  </p>
                </div>

                {cart.hasPacks(item.id) && vendor.vendorSlug ? (
                  <button
                    onClick={() =>
                      onOpenVendor(
                        vendor.vendorSlug!,
                        vendor.vendorName,
                        item.id,
                      )
                    }
                    className="shrink-0 rounded-full bg-[var(--color-orange)] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm transition active:scale-95"
                  >
                    {cart.quantityOf(item.id)} in cart · Add
                  </button>
                ) : (
                  <QuantityStepper
                    quantity={cart.quantityOf(item.id)}
                    onAdd={async () => {
                      const plain = () =>
                        cart.add({
                          productId: item.id,
                          name: item.name,
                          unitPrice: item.price,
                          imageUrl: item.imageUrl,
                          vendorId: vendor.vendorId,
                          vendorName: vendor.vendorName,
                          vendorSlug: vendor.vendorSlug,
                        });
                      const slug = vendor.vendorSlug;
                      if (!slug) return plain();
                      // The same menu the vendor sheet loads, so usually cached.
                      const menu = await queryClient
                        .fetchQuery({
                          queryKey: ['storefront', slug],
                          queryFn: () => api.getStorefront(slug),
                          staleTime: 60_000,
                        })
                        .catch(() => null);
                      const product = menu?.products.find(
                        (p) => p.id === item.id,
                      );
                      if (product && isBuildable(product)) {
                        onOpenVendor(slug, vendor.vendorName, item.id);
                      } else {
                        plain();
                      }
                    }}
                    onChange={(quantity) => cart.setQuantity(item.id, quantity)}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
