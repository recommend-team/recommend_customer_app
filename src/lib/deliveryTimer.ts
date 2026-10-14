import type { BuyerOrder, OrderStatus } from './contract';

/**
 * The delivery timer: a bar that fills from payment to the expected delivery time.
 *
 * Deliberately only a clock — it says how long the buyer has been waiting against how
 * long it should take, not what stage the order is at. Once the time is up it stays full
 * and says the order is close, until the buyer confirms they have it.
 */

/** Paid and not yet received or called off. */
const UNDER_WAY: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'PAID',
  'PROCESSING',
  'READY',
  'DISPATCHED',
]);

/** Half the width of "arriving around 12:40 – 12:50", either side of the estimate. */
const WINDOW_MINUTES = 5;

/** Deliveries the timer runs for, the most recently paid first. */
export function trackedOrders(orders: BuyerOrder[]): BuyerOrder[] {
  return orders
    .filter(
      (order) =>
        order.fulfillmentType === 'DELIVERY' &&
        UNDER_WAY.has(order.status) &&
        !!order.paidAt &&
        !!order.expectedBy,
    )
    .sort((a, b) => Date.parse(b.paidAt!) - Date.parse(a.paidAt!));
}

export interface TimerState {
  /** Whole minutes since payment, never past the estimate. */
  elapsedMinutes: number;
  totalMinutes: number;
  /** 0 to 1: how full the bar is. */
  progress: number;
  /** The estimate has passed and the buyer has not said they have it. */
  late: boolean;
  windowFrom: Date;
  windowTo: Date;
}

/** Where the timer is for `order` at `now`. Only for orders `trackedOrders` returns. */
export function deliveryTimer(order: BuyerOrder, now: number): TimerState {
  const start = Date.parse(order.paidAt!);
  const end = Date.parse(order.expectedBy!);
  const length = Math.max(60_000, end - start);
  const elapsed = Math.max(0, now - start);

  return {
    elapsedMinutes: Math.min(Math.floor(elapsed / 60_000), order.etaMinutes),
    totalMinutes: order.etaMinutes,
    progress: Math.min(1, elapsed / length),
    late: now >= end,
    windowFrom: new Date(end - WINDOW_MINUTES * 60_000),
    windowTo: new Date(end + WINDOW_MINUTES * 60_000),
  };
}

/** "12:40 PM" — the same format as the chat's own timestamps. */
export function clockTime(date: Date): string {
  return date
    .toLocaleTimeString('en-NG', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toUpperCase();
}
