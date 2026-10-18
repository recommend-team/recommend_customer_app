/**
 * The cart.
 *
 * Lives entirely in the client — the backend deliberately stores no cart. It is sent at
 * checkout, where **every price is recomputed from the database**, so the prices held here
 * are for display only. `expectedUnitPrice` is passed along purely so the server can say
 * "this changed since you added it" instead of quietly charging a different amount.
 *
 * A dish with extras or choices goes in as a **pack** — portions, choices, extras — which
 * the buyer can repeat ×N and open again to change. Anything else is a plain line.
 *
 * Framework-agnostic: a plain observable store, no React. `hooks/useCart.ts` adapts it.
 */

import type { CheckoutItem } from '../contract';

export interface CartLine {
  /** Tells two builds of the same dish apart. */
  key: string;
  productId: string;
  name: string;
  /** What was displayed when it went in. Display + drift detection only. */
  unitPrice: number;
  /** Portions in each pack, for a pack; how many, for a plain line. */
  quantity: number;
  imageUrl: string | null;
  vendorId: string;
  vendorName: string | null;
  vendorSlug: string | null;
  /**
   * An extra — drinks, extra protein — sold only with a main item from the same vendor.
   * Absent on lines saved before add-ons existed, which reads as a main item.
   */
  isAddOn?: boolean;
  /** "portion" — what `quantity` counts on a pack. */
  unit?: string | null;
  /** Set on a pack: how many identical packs. */
  packs?: number;
  /** In each pack. */
  extras?: CartExtra[];
  choices?: CartChoice[];
}

export interface CartExtra {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface CartChoice {
  groupId: string;
  groupName: string;
  options: { id: string; name: string; priceDelta: number }[];
}

/** A pack from the dish sheet — everything but the key the cart gives it. */
export type PackInput = Omit<CartLine, 'key' | 'packs'> & { packs: number };

export interface CartVendorGroup {
  vendorId: string;
  vendorName: string | null;
  vendorSlug: string | null;
  lines: CartLine[];
  subtotal: number;
}

export interface CartState {
  lines: CartLine[];
  /** Packs count once each, plain items by quantity. */
  itemCount: number;
  /** Sum of what the client last saw. The authoritative total comes from checkout. */
  goodsTotal: number;
  vendorCount: number;
  /**
   * Extras the last change took out, because their vendor no longer has a main item in
   * the cart. Named so the cart can say why they went, rather than have them vanish.
   */
  removedExtras: string[];
}

const STORAGE_KEY = 'recommend.cart.v1';
const MAX_QUANTITY = 50;
export const MAX_PORTIONS = 10;
export const MAX_EXTRA = 5;
export const MAX_PACKS = 50;

type Listener = () => void;

class CartStore {
  private lines: CartLine[] = [];
  private listeners = new Set<Listener>();
  private snapshot: CartState = derive([]);

  constructor() {
    this.lines = load();
    this.snapshot = derive(this.lines);
  }

  getState = (): CartState => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Adding the same product again increases its quantity rather than duplicating it. */
  add = (line: Omit<CartLine, 'quantity' | 'key'>, quantity = 1): void => {
    const existing = this.lines.find(
      (l) => l.productId === line.productId && !isPack(l),
    );

    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
      // Refresh the displayed price — the catalogue may have moved since it went in.
      existing.unitPrice = line.unitPrice;
    } else {
      this.lines = [
        ...this.lines,
        {
          ...line,
          key: newKey(),
          quantity: Math.min(MAX_QUANTITY, Math.max(1, quantity)),
        },
      ];
    }

    this.commit();
  };

  /** A pack from the dish sheet. Built exactly like one already in, it adds packs. */
  addPack = (pack: PackInput): void => {
    const same = this.lines.find(
      (line) => isPack(line) && sameBuild(line, pack),
    );
    if (same) {
      same.packs = Math.min(MAX_PACKS, (same.packs ?? 1) + pack.packs);
    } else {
      this.lines = [...this.lines, { ...pack, key: newKey() }];
    }
    this.commit();
  };

  /** A pack changed in the dish sheet: it keeps its place in the cart. */
  replacePack = (key: string, pack: PackInput): void => {
    this.lines = this.lines.map((line) =>
      line.key === key ? { ...pack, key } : line,
    );
    this.commit();
  };

  /** Packs on a pack, the count on a plain line. 0 takes it out. */
  setCount = (key: string, count: number): void => {
    if (count <= 0) return this.removeLine(key);
    const line = this.lines.find((l) => l.key === key);
    if (!line) return;
    if (isPack(line)) line.packs = Math.min(MAX_PACKS, count);
    else line.quantity = Math.min(MAX_QUANTITY, count);
    this.commit();
  };

  removeLine = (key: string): void => {
    this.lines = this.lines.filter((l) => l.key !== key);
    this.commit();
  };

  /** A plain product's count. Packs are changed by key. */
  setQuantity = (productId: string, quantity: number): void => {
    if (quantity <= 0) return this.remove(productId);

    const line = this.lines.find(
      (l) => l.productId === productId && !isPack(l),
    );
    if (!line) return;

    line.quantity = Math.min(MAX_QUANTITY, quantity);
    this.commit();
  };

  /** Take a plain product out. Packs are removed by key. */
  remove = (productId: string): void => {
    this.lines = this.lines.filter(
      (l) => l.productId !== productId || isPack(l),
    );
    this.commit();
  };

  clear = (): void => {
    this.lines = [];
    this.commit();
  };

  /** How many of a product are in: packs, for a dish built as packs. */
  quantityOf = (productId: string): number =>
    this.lines
      .filter((l) => l.productId === productId)
      .reduce((sum, l) => sum + count(l), 0);

  /** Whether a product is in as a pack — its count is then changed in the dish sheet. */
  hasPacks = (productId: string): boolean =>
    this.lines.some((l) => l.productId === productId && isPack(l));

  /** Grouped for display — the backend splits by vendor too, one order each. */
  groups = (): CartVendorGroup[] => {
    const byVendor = new Map<string, CartVendorGroup>();

    for (const line of this.lines) {
      const group = byVendor.get(line.vendorId) ?? {
        vendorId: line.vendorId,
        vendorName: line.vendorName,
        vendorSlug: line.vendorSlug,
        lines: [],
        subtotal: 0,
      };
      group.lines.push(line);
      group.subtotal = round2(
        group.lines.reduce((sum, l) => sum + lineTotal(l), 0),
      );
      byVendor.set(line.vendorId, group);
    }

    return [...byVendor.values()];
  };

  /** Exactly the shape `checkout:start` expects — packs whole. */
  toCheckoutItems = (): CheckoutItem[] =>
    this.lines.map((line) => {
      const item = {
        productId: line.productId,
        quantity: line.quantity,
        expectedUnitPrice: line.unitPrice,
      };
      if (!isPack(line)) return item;
      return {
        ...item,
        packs: line.packs,
        extras: (line.extras ?? []).map((extra) => ({
          productId: extra.productId,
          quantity: extra.quantity,
          expectedUnitPrice: extra.unitPrice,
        })),
        choices: (line.choices ?? []).map((choice) => ({
          groupId: choice.groupId,
          optionIds: choice.options.map((option) => option.id),
        })),
      };
    });

  private commit(): void {
    // An extra rides with a meal from its own kitchen: with no main item left from its
    // vendor, it goes too. The server refuses one on its own regardless.
    const vendorsWithMain = new Set(
      this.lines.filter((line) => !line.isAddOn).map((line) => line.vendorId),
    );
    const orphaned = this.lines.filter(
      (line) => line.isAddOn && !vendorsWithMain.has(line.vendorId),
    );
    if (orphaned.length > 0) {
      this.lines = this.lines.filter((line) => !orphaned.includes(line));
    }

    this.snapshot = derive(
      this.lines,
      orphaned.map((line) => line.name),
    );
    save(this.lines);
    this.listeners.forEach((listener) => listener());
  }
}

export function isPack(line: Pick<CartLine, 'packs'>): boolean {
  return line.packs !== undefined;
}

/** Packs on a pack, the count on a plain line. */
function count(line: CartLine): number {
  return line.packs ?? line.quantity;
}

/** Per portion, with what the chosen options add. */
export function portionPrice(
  line: Pick<CartLine, 'unitPrice' | 'choices'>,
): number {
  return (
    line.unitPrice +
    (line.choices ?? []).reduce(
      (sum, choice) =>
        sum + choice.options.reduce((s, option) => s + option.priceDelta, 0),
      0,
    )
  );
}

/** One pack: its portions with their options, and its extras. */
export function packTotal(
  line: Pick<CartLine, 'unitPrice' | 'quantity' | 'choices' | 'extras'>,
): number {
  return round2(
    portionPrice(line) * line.quantity +
      (line.extras ?? []).reduce(
        (sum, extra) => sum + extra.unitPrice * extra.quantity,
        0,
      ),
  );
}

/** The whole line: every pack, or every one of a plain item. */
export function lineTotal(line: CartLine): number {
  return isPack(line)
    ? round2(packTotal(line) * (line.packs ?? 1))
    : round2(line.unitPrice * line.quantity);
}

/** "portion" → "2 portions"; no unit → "×2". */
export function portionsText(quantity: number, unit?: string | null): string {
  if (!unit) return `×${quantity}`;
  return `${quantity} ${quantity === 1 ? unit : `${unit}s`}`;
}

/** What's in a pack, a line each: "2 portions each", "Protein: Beef", "+ Beef ×2". */
export function packDetails(line: CartLine): string[] {
  const each = (line.packs ?? 1) > 1 ? ' each' : '';
  return [
    `${portionsText(line.quantity, line.unit)}${each}`,
    ...(line.choices ?? []).map(
      (choice) =>
        `${shortGroup(choice.groupName)}: ${choice.options.map((o) => o.name).join(' & ')}`,
    ),
    ...((line.extras ?? []).length > 0
      ? [
          `+ ${(line.extras ?? []).map((e) => `${e.name} ×${e.quantity}`).join(', ')}`,
        ]
      : []),
  ];
}

/** "Choose your protein" → "Protein", as receipts read it. */
export function shortGroup(name: string): string {
  const short = name
    .trim()
    .replace(/^(choose|pick|select)\s+/i, '')
    .replace(/^(your|a|an|the)\s+/i, '');
  return short ? short.charAt(0).toUpperCase() + short.slice(1) : name;
}

type Build = Pick<CartLine, 'productId' | 'quantity' | 'extras' | 'choices'>;

/** The same dish built the same way. */
function sameBuild(a: Build, b: Build): boolean {
  const extras = (line: Build) =>
    (line.extras ?? [])
      .map((e) => `${e.productId}:${e.quantity}`)
      .sort()
      .join(',');
  const choices = (line: Build) =>
    (line.choices ?? [])
      .map(
        (c) =>
          `${c.groupId}:${c.options
            .map((o) => o.id)
            .sort()
            .join('+')}`,
      )
      .sort()
      .join(',');
  return (
    a.productId === b.productId &&
    a.quantity === b.quantity &&
    extras(a) === extras(b) &&
    choices(a) === choices(b)
  );
}

function newKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function derive(lines: CartLine[], removedExtras: string[] = []): CartState {
  return {
    removedExtras,
    lines: [...lines],
    itemCount: lines.reduce((sum, line) => sum + count(line), 0),
    goodsTotal: round2(lines.reduce((sum, line) => sum + lineTotal(line), 0)),
    vendorCount: new Set(lines.map((line) => line.vendorId)).size,
  };
}

function load(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // A cart written by an older build could be any shape; keep only usable lines.
    return parsed
      .filter(
        (line): line is CartLine =>
          typeof line === 'object' &&
          line !== null &&
          typeof (line as CartLine).productId === 'string' &&
          typeof (line as CartLine).quantity === 'number',
      )
      .map((line) => ({
        ...line,
        // Lines from before packs had no key: one plain line per product.
        key: typeof line.key === 'string' ? line.key : line.productId,
      }));
  } catch {
    return [];
  }
}

function save(lines: CartLine[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private mode, or storage full. The cart still works for this session.
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const cart = new CartStore();

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}
