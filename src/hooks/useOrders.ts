import { useCallback, useEffect, useMemo, useState } from 'react';
import { chatClient } from '../lib/socket';
import { useAccount } from './useAccount';
import type { BuyerOrder, OrderStatus } from '../lib/contract';

export interface UseOrders {
  orders: BuyerOrder[];
  /** True until the first reply arrives, so an empty list is not shown prematurely. */
  loading: boolean;
  /** Set when the request went unanswered — see `TIMEOUT_MS`. */
  failed: boolean;
  refresh: () => void;
  complete: (reference: string) => void;
  /** Paid and not yet finished — what the Orders tab counts. */
  inProgress: number;
  /** An order is new or has moved on since the buyer last looked. */
  hasNews: boolean;
}

const TIMEOUT_MS = 8000;

/** Paid, and still somewhere between the vendor and the buyer. */
const IN_PROGRESS: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'PAID',
  'PROCESSING',
  'READY',
  'DISPATCHED',
]);

/** Each order's status as the buyer last saw it, so news survives a reload. */
const SEEN_KEY = 'recommend:orders-seen';
type Seen = Record<string, OrderStatus>;

function loadSeen(): Seen | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    return null;
  }
}

function saveSeen(seen: Seen): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Private mode: news is then only tracked until the page closes.
  }
}

/**
 * The buyer's orders. Kept fresh in the background — on connect, and whenever order news
 * arrives in the chat — so the Orders tab can say there is something to look at before
 * it is opened. `active` is the sheet being open: only then is a slow reply an error.
 */
export function useOrders(active: boolean, connected: boolean): UseOrders {
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // Null until the first list arrives on a device that has never looked.
  const [seen, setSeen] = useState<Seen | null>(loadSeen);

  useEffect(() => {
    chatClient.setOrdersHandler((next) => {
      setOrders(next);
      setLoading(false);
      setFailed(false);
    });
    return () => chatClient.setOrdersHandler(undefined);
  }, []);

  // Quietly, without the loading state the open sheet shows. Signing in or out swaps
  // whose orders these are.
  const { email } = useAccount();
  useEffect(() => {
    if (connected) chatClient.requestOrders();
  }, [connected, email]);

  useEffect(
    () =>
      chatClient.onLiveMessage((message) => {
        if (message.alert) chatClient.requestOrders();
      }),
    [],
  );

  const request = useCallback(() => {
    setLoading(true);
    setFailed(false);
    chatClient.requestOrders();
  }, []);

  useEffect(() => {
    if (!active) return;
    request();

    const timer = setTimeout(() => {
      // The handler clears `loading`; if it is still set, nothing answered.
      setLoading((stillWaiting) => {
        if (stillWaiting) setFailed(true);
        return false;
      });
    }, TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [active, request]);

  // Looking at the sheet is seeing what is in it.
  useEffect(() => {
    if (!active || orders.length === 0) return;
    const next = Object.fromEntries(
      orders.map((order) => [order.reference, order.status]),
    );
    setSeen(next);
    saveSeen(next);
  }, [active, orders]);

  const complete = useCallback((reference: string) => {
    chatClient.completeOrder(reference);
  }, []);

  const { inProgress, hasNews } = useMemo(() => {
    const live = orders.filter((order) => IN_PROGRESS.has(order.status));
    return {
      inProgress: live.length,
      // A device that has never opened Orders has not seen any of them.
      hasNews: live.some((order) => seen?.[order.reference] !== order.status),
    };
  }, [orders, seen]);

  return {
    orders,
    loading,
    failed,
    refresh: request,
    complete,
    inProgress,
    hasNews: hasNews && !active,
  };
}
