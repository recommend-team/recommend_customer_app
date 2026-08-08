import { useSyncExternalStore } from 'react';
import { cart } from '../lib/cart/cart';
import type { CartLine, CartState, CartVendorGroup } from '../lib/cart/cart';

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
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  quantityOf: (productId: string) => number;
  groups: () => CartVendorGroup[];
  toCheckoutItems: () => {
    productId: string;
    quantity: number;
    expectedUnitPrice: number;
  }[];
}

export function useCart(): UseCart {
  const state = useSyncExternalStore(cart.subscribe, cart.getState);

  return {
    ...state,
    add: cart.add,
    remove: cart.remove,
    setQuantity: cart.setQuantity,
    clear: cart.clear,
    quantityOf: cart.quantityOf,
    groups: cart.groups,
    toCheckoutItems: cart.toCheckoutItems,
  };
}
