import type { VendorListData } from '../../../lib/contract';

/**
 * Vendors the bot found. Tapping one opens their menu over the conversation.
 *
 * A closed vendor is shown but not tappable — hiding it would leave the buyer wondering
 * why a shop they know exists never appears.
 */
export function VendorListCard({
  data,
  onOpenVendor,
}: {
  data: VendorListData;
  onOpenVendor: (slug: string, name: string | null) => void;
}) {
  const vendors = data?.vendors ?? [];
  if (vendors.length === 0) return null;

  return (
    <div className="mt-2 w-full max-w-[92%] space-y-2">
      {vendors.map((vendor) => {
        const openable = vendor.isOpen && !!vendor.slug;

        return (
          <button
            key={vendor.id}
            disabled={!openable}
            onClick={() =>
              vendor.slug && onOpenVendor(vendor.slug, vendor.name)
            }
            className={`flex w-full items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left shadow-sm transition ${
              openable ? 'active:scale-[0.99]' : 'opacity-60'
            }`}
          >
            {vendor.logoUrl ? (
              <img
                src={vendor.logoUrl}
                alt=""
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-cream-deep)] text-[13px] font-bold text-[var(--color-orange)]">
                {(vendor.name ?? '?').charAt(0).toUpperCase()}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-[var(--color-ink)]">
                {vendor.name}
              </p>
              <p className="truncate text-[12px] text-[var(--color-ink)]/55">
                {[vendor.category, vendor.areas.slice(0, 2).join(', ')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                vendor.isOpen
                  ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                  : 'bg-black/5 text-[var(--color-ink)]/45'
              }`}
            >
              {vendor.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
