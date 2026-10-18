import { useSyncExternalStore } from 'react';
import { cart } from '../lib/cart/cart';
import type {
  CartLine,
  CartState,
  CartVendorGroup,
  PackInput,
} from '../lib/cart/cart';
import type { CheckoutItem } from '../lib/contract';

/**
 * React's view of the cart store.
 *
 * `useSyncExternalStore` rather than a state library, so the store itself stays
 * framework-agnostic and portable to a native app.
 *
 * The surface is spelled out rather than inferred from the store: `CartState & typeof cart`
 * collapses to `never`, because the class keeps `lines` private and TypeScript refuses to
 * intersect a private field with a public one of the same name.
 */
export interface UseCart extends CartState {
  add: (line: Omit<CartLine, 'quantity' | 'key'>, quantity?: number) => void;
  addPack: (pack: PackInput) => void;
  replacePack: (key: string, pack: PackInput) => void;
  setCount: (key: string, count: number) => void;
  removeLine: (key: string) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  quantityOf: (productId: string) => number;
  hasPacks: (productId: string) => boolean;
  groups: () => CartVendorGroup[];
  toCheckoutItems: () => CheckoutItem[];
}

export function useCart(): UseCart {
  const state = useSyncExternalStore(cart.subscribe, cart.getState);

  return {
    ...state,
    add: cart.add,
    addPack: cart.addPack,
    replacePack: cart.replacePack,
    setCount: cart.setCount,
    removeLine: cart.removeLine,
    remove: cart.remove,
    setQuantity: cart.setQuantity,
    clear: cart.clear,
    quantityOf: cart.quantityOf,
    hasPacks: cart.hasPacks,
    groups: cart.groups,
    toCheckoutItems: cart.toCheckoutItems,
  };
}
