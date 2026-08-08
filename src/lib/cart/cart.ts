/**
 * The cart.
 *
 * Lives entirely in the client — the backend deliberately stores no cart. It is sent at
 * checkout, where **every price is recomputed from the database**, so the prices held here
 * are for display only. `expectedUnitPrice` is passed along purely so the server can say
 * "this changed since you added it" instead of quietly charging a different amount.
 *
 * Framework-agnostic: a plain observable store, no React. `hooks/useCart.ts` adapts it.
 */

export interface CartLine {
  productId: string;
  name: string;
  /** What was displayed when it went in. Display + drift detection only. */
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  vendorId: string;
  vendorName: string | null;
  vendorSlug: string | null;
}

export interface CartVendorGroup {
  vendorId: string;
  vendorName: string | null;
  vendorSlug: string | null;
  lines: CartLine[];
  subtotal: number;
}

export interface CartState {
  lines: CartLine[];
  itemCount: number;
  /** Sum of what the client last saw. The authoritative total comes from checkout. */
  goodsTotal: number;
  vendorCount: number;
}

const STORAGE_KEY = 'recommend.cart.v1';
const MAX_QUANTITY = 50;

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
  add = (line: Omit<CartLine, 'quantity'>, quantity = 1): void => {
    const existing = this.lines.find((l) => l.productId === line.productId);

    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
      // Refresh the displayed price — the catalogue may have moved since it went in.
      existing.unitPrice = line.unitPrice;
    } else {
      this.lines = [
        ...this.lines,
        { ...line, quantity: Math.min(MAX_QUANTITY, Math.max(1, quantity)) },
      ];
    }

    this.commit();
  };

  setQuantity = (productId: string, quantity: number): void => {
    if (quantity <= 0) return this.remove(productId);

    const line = this.lines.find((l) => l.productId === productId);
    if (!line) return;

    line.quantity = Math.min(MAX_QUANTITY, quantity);
    this.commit();
  };

  remove = (productId: string): void => {
    this.lines = this.lines.filter((l) => l.productId !== productId);
    this.commit();
  };

  clear = (): void => {
    this.lines = [];
    this.commit();
  };

  quantityOf = (productId: string): number =>
    this.lines.find((l) => l.productId === productId)?.quantity ?? 0;

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
        group.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
      );
      byVendor.set(line.vendorId, group);
    }

    return [...byVendor.values()];
  };

  /** Exactly the shape `checkout:start` expects. */
  toCheckoutItems = () =>
    this.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      expectedUnitPrice: line.unitPrice,
    }));

  private commit(): void {
    this.snapshot = derive(this.lines);
    save(this.lines);
    this.listeners.forEach((listener) => listener());
  }
}

function derive(lines: CartLine[]): CartState {
  return {
    lines: [...lines],
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    goodsTotal: round2(
      lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    ),
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
    return parsed.filter(
      (line): line is CartLine =>
        typeof line === 'object' &&
        line !== null &&
        typeof (line as CartLine).productId === 'string' &&
        typeof (line as CartLine).quantity === 'number',
    );
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
