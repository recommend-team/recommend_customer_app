import { useCallback, useEffect, useState } from 'react';
import { chatClient } from '../lib/socket';
import type { BuyerOrder } from '../lib/contract';

export interface UseOrders {
  orders: BuyerOrder[];
  /** True until the first reply arrives, so an empty list is not shown prematurely. */
  loading: boolean;
  /** Set when the request went unanswered — see `TIMEOUT_MS`. */
  failed: boolean;
  refresh: () => void;
  complete: (reference: string) => void;
}

const TIMEOUT_MS = 8000;

export function useOrders(active: boolean): UseOrders {
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    chatClient.setOrdersHandler((next) => {
      setOrders(next);
      setLoading(false);
      setFailed(false);
    });
    return () => chatClient.setOrdersHandler(undefined);
  }, []);

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

  const complete = useCallback((reference: string) => {
    chatClient.completeOrder(reference);
  }, []);

  return { orders, loading, failed, refresh: request, complete };
}
