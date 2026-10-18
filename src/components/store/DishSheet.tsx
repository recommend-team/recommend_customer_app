import { useMemo, useState } from 'react';
import { useCart } from '../../hooks/useCart';
import {
  MAX_EXTRA,
  MAX_PACKS,
  MAX_PORTIONS,
  formatNaira,
  lineTotal,
  packTotal,
  portionsText,
} from '../../lib/cart/cart';
import type { CartLine, PackInput } from '../../lib/cart/cart';
import type { ChoiceGroup, StorefrontResponse } from '../../lib/contract';
import { Sheet } from '../ui/Sheet';

type Storefront = StorefrontResponse;
type Product = Storefront['products'][number];

/** Whether a dish is built as a pack: it has extras to add or choices to answer. */
export function isBuildable(product: Product): boolean {
  return (
    !product.isAddOn &&
    ((product.extraIds?.length ?? 0) > 0 || (product.choices?.length ?? 0) > 0)
  );
}

/**
 * Build a pack of one dish: how many portions, its choices, its extras, and how many
 * packs like it. A required choice must be answered before it goes in the cart.
 *
 * Opened from the cart with `editing`, it changes that pack instead — or removes it.
 */
export function DishSheet({
  storefront,
  product,
  editing = null,
  onClose,
}: {
  storefront: Storefront;
  /** Null: closed. */
  product: Product | null;
  editing?: CartLine | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={!!product}
      title={product?.name ?? ''}
      subtitle={
        product
          ? `${formatNaira(product.price)}${product.unit ? ` per ${product.unit}` : ''}`
          : undefined
      }
      onClose={onClose}
    >
      {product && (
        // Keyed, so opening another dish starts afresh.
        <Builder
          key={`${product.id}-${editing?.key ?? 'new'}`}
          storefront={storefront}
          product={product}
          editing={editing}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
}

function Builder({
  storefront,
  product,
  editing,
  onDone,
}: {
  storefront: Storefront;
  product: Product;
  editing: CartLine | null;
  onDone: () => void;
}) {
  const cart = useCart();
  const { vendor } = storefront;
  const extrasOnOffer = useMemo(() => {
    const byId = new Map(storefront.products.map((p) => [p.id, p]));
    return (product.extraIds ?? [])
      .map((id) => byId.get(id))
      .filter(
        (extra): extra is Product => !!extra && extra.isAvailable !== false,
      );
  }, [storefront.products, product.extraIds]);

  const [portions, setPortions] = useState(editing?.quantity ?? 1);
  const [packs, setPacks] = useState(editing?.packs ?? 1);
  const [extras, setExtras] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (editing?.extras ?? []).map((e) => [e.productId, e.quantity]),
    ),
  );
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      (editing?.choices ?? []).map((c) => [
        c.groupId,
        c.options.map((o) => o.id),
      ]),
    ),
  );

  const groups = product.choices ?? [];
  const pack: PackInput = {
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity: portions,
    packs,
    imageUrl: product.imageUrl,
    vendorId: vendor.id,
    vendorName: vendor.businessName,
    vendorSlug: vendor.slug,
    isAddOn: false,
    unit: product.unit ?? null,
    extras: extrasOnOffer
      .filter((extra) => (extras[extra.id] ?? 0) > 0)
      .map((extra) => ({
        productId: extra.id,
        name: extra.name,
        unitPrice: extra.price,
        quantity: extras[extra.id],
      })),
    choices: groups.flatMap((group) => {
      const options = group.options.filter(
        (option) =>
          option.isAvailable && (picked[group.id] ?? []).includes(option.id),
      );
      return options.length > 0
        ? [
            {
              groupId: group.id,
              groupName: group.name,
              options: options.map(({ id, name, priceDelta }) => ({
                id,
                name,
                priceDelta,
              })),
            },
          ]
        : [];
    }),
  };

  const missing = groups.find((group) => {
    const chosen = pack.choices?.find((c) => c.groupId === group.id);
    return (chosen?.options.length ?? 0) < group.minPick;
  });
  const total = lineTotal({ ...pack, key: '' });
  const unitWord = product.unit ?? 'item';

  const pick = (group: ChoiceGroup, optionId: string) =>
    setPicked((current) => {
      const chosen = current[group.id] ?? [];
      if (chosen.includes(optionId)) {
        return {
          ...current,
          [group.id]: chosen.filter((id) => id !== optionId),
        };
      }
      // Pick one: the new choice replaces the old.
      if (group.maxPick === 1) return { ...current, [group.id]: [optionId] };
      if (chosen.length >= group.maxPick) return current;
      return { ...current, [group.id]: [...chosen, optionId] };
    });

  const save = () => {
    if (editing) cart.replacePack(editing.key, pack);
    else cart.addPack(pack);
    onDone();
  };

  return (
    <div className="pb-3">
      {product.description && (
        <p className="pt-1 text-[14px] leading-snug text-[var(--color-ink)]/70">
          {product.description}
        </p>
      )}

      <Section
        title={product.unit ? `How many ${product.unit}s?` : 'How many?'}
      >
        <Stepper
          label={product.unit ? `${product.unit}s` : product.name}
          value={portions}
          min={1}
          max={MAX_PORTIONS}
          onChange={setPortions}
          words={[`One fewer ${unitWord}`, `One more ${unitWord}`]}
        />
      </Section>

      {groups.map((group) => {
        const chosen = picked[group.id] ?? [];
        const full = group.maxPick > 1 && chosen.length >= group.maxPick;
        return (
          <Section
            key={group.id}
            title={group.name}
            badge={group.required ? 'Required' : 'Optional'}
            hint={pickHint(group)}
          >
            <div role="group" aria-label={group.name} className="space-y-2">
              {group.options.map((option) => {
                const on = chosen.includes(option.id);
                return (
                  <button
                    key={option.id}
                    role={group.maxPick === 1 ? 'radio' : 'checkbox'}
                    aria-checked={on}
                    disabled={!option.isAvailable || (!on && full)}
                    onClick={() => pick(group, option.id)}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-[15px] transition disabled:opacity-45 ${
                      on
                        ? 'border-[var(--color-orange)] bg-[#fff4ee]'
                        : 'border-[#e4e2db] bg-white'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`grid h-5 w-5 shrink-0 place-items-center border-2 ${
                        group.maxPick === 1 ? 'rounded-full' : 'rounded-md'
                      } ${
                        on
                          ? 'border-[var(--color-orange)] bg-[var(--color-orange)] text-white'
                          : 'border-[#c9c7bf]'
                      }`}
                    >
                      {on && <CheckIcon />}
                    </span>
                    <span className="flex-1 font-medium text-[var(--color-ink)]">
                      {option.name}
                    </span>
                    <span className="text-[13px] text-[var(--color-ink)]/55">
                      {!option.isAvailable
                        ? 'Sold out'
                        : option.priceDelta > 0
                          ? `+${formatNaira(option.priceDelta)}${product.unit ? ` per ${product.unit}` : ' each'}`
                          : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>
        );
      })}

      {extrasOnOffer.length > 0 && (
        <Section
          title="Extras"
          hint={packs > 1 ? 'In each pack' : `Up to ${MAX_EXTRA} of each`}
        >
          <ul className="divide-y divide-[#f0efea]">
            {extrasOnOffer.map((extra) => (
              <li key={extra.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-[15px] text-[var(--color-ink)]">
                  <span className="font-medium">{extra.name}</span>
                  <span className="block text-[13px] text-[var(--color-ink)]/55">
                    {formatNaira(extra.price)}
                  </span>
                </span>
                <Stepper
                  small
                  label={extra.name}
                  value={extras[extra.id] ?? 0}
                  min={0}
                  max={MAX_EXTRA}
                  onChange={(next) =>
                    setExtras((current) => ({ ...current, [extra.id]: next }))
                  }
                  words={[`One fewer ${extra.name}`, `One more ${extra.name}`]}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="How many packs like this?"
        hint="Each pack is packed separately"
      >
        <Stepper
          label="packs"
          value={packs}
          min={1}
          max={MAX_PACKS}
          onChange={setPacks}
          words={['One fewer pack', 'One more pack']}
        />
      </Section>

      <div className="sticky bottom-0 -mx-4 mt-5 border-t border-[var(--color-hairline)] bg-white px-4 pt-3">
        {missing && (
          <p className="mb-2 text-center text-[13px] font-medium text-[#9a3412]">
            {missing.name} — pick{' '}
            {missing.minPick === 1 ? 'one' : missing.minPick}
          </p>
        )}
        <div className="flex items-center gap-2">
          {editing && (
            <button
              onClick={() => {
                cart.removeLine(editing.key);
                onDone();
              }}
              className="h-12 rounded-2xl px-3 text-[14px] font-bold text-[#b42318] active:bg-red-50"
            >
              Remove
            </button>
          )}
          <button
            onClick={save}
            disabled={!!missing}
            className="flex h-12 flex-1 items-center justify-between rounded-2xl bg-[var(--color-orange)] px-4 text-[16px] font-bold text-white shadow-md transition active:scale-[0.99] disabled:bg-black/15 disabled:shadow-none"
          >
            <span>{editing ? 'Update cart' : 'Add to cart'}</span>
            <span className="tabular-nums">{formatNaira(total)}</span>
          </button>
        </div>
        <p className="mt-1.5 text-center text-[12px] text-[var(--color-ink)]/55">
          {packs > 1
            ? `${packs} packs × ${formatNaira(packTotal(pack))} · ${portionsText(portions, product.unit)} in each`
            : `${portionsText(portions, product.unit)}${(pack.extras ?? []).length > 0 ? ' with extras' : ''}`}
        </p>
      </div>
    </div>
  );
}

/** "Pick 1", "Pick up to 2", "Pick 2 to 3". */
function pickHint(group: ChoiceGroup): string {
  if (group.minPick === group.maxPick || group.maxPick === 1) {
    return `Pick ${group.maxPick}`;
  }
  if (group.minPick <= 1) return `Pick up to ${group.maxPick}`;
  return `Pick ${group.minPick} to ${group.maxPick}`;
}

function Section({
  title,
  badge,
  hint,
  children,
}: {
  title: string;
  badge?: 'Required' | 'Optional';
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-bold text-[var(--color-ink)]">
          {title}
        </h3>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
              badge === 'Required'
                ? 'bg-[#fff1eb] text-[#b23a12]'
                : 'bg-[#f4f3ef] text-[#5b6270]'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-0.5 text-[12px] text-[var(--color-ink)]/55">{hint}</p>
      )}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  words,
  small = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  /** What − and + say to a screen reader. */
  words: [string, string];
  small?: boolean;
}) {
  const size = small ? 'h-9 w-9' : 'h-11 w-11';
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center rounded-2xl bg-[#f4f3ef] ${small ? 'h-9' : 'h-11'}`}
    >
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={words[0]}
        className={`grid ${size} place-items-center text-lg leading-none text-[var(--color-ink)] disabled:opacity-30`}
      >
        −
      </button>
      <span
        className={`${small ? 'w-5 text-[15px]' : 'w-7 text-[17px]'} text-center font-bold text-[var(--color-ink)] tabular-nums`}
      >
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={words[1]}
        className={`grid ${size} place-items-center text-lg leading-none text-[var(--color-ink)] disabled:opacity-30`}
      >
        +
      </button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
