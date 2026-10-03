/**
 * Order notifications: what a push looks like, and what is worth a sound.
 *
 * Shared by the service worker (`sw.ts`) and the page, so a notification in the
 * background and a chime in the foreground can never disagree. Framework-free, like the
 * rest of `lib/`.
 */

/** What the server pushes — `recommend-be` → `src/chat/ports/push.port.ts`. */
export type BuyerPushType =
  'PAYMENT_CONFIRMED' | 'ORDER_READY' | 'ORDER_DISPATCHED' | 'REPLY';

/**
 * The pushes that chime when the app is open. Order news only.
 *
 * Not `REPLY`: the assistant's own replies never chime, so a chime on a person's reply
 * would be the one thing that gave away a person had taken over — which the buyer is
 * deliberately never told (`recommend-be` → ADMIN_CHAT_PLAN.md §2).
 */
export const CHIMING_TYPES: ReadonlySet<string> = new Set<BuyerPushType>([
  'PAYMENT_CONFIRMED',
  'ORDER_READY',
  'ORDER_DISPATCHED',
]);

/** Messages from the service worker to the page. */
export const SW_PUSH_RECEIVED = 'recommend:buyer-push-received';

export interface BuyerPush {
  title: string;
  body: string;
  type: string | null;
  /** An in-app path. In practice always the chat. */
  url: string;
  tag: string | null;
}

/** A push payload, read defensively — it comes off the network into code that opens windows. */
export function parsePush(raw: unknown): BuyerPush {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;
  const text = (field: unknown) =>
    typeof field === 'string' && field.trim() ? field : null;

  return {
    title: text(value.title) ?? 'Recommend',
    body: text(value.body) ?? '',
    type: text(value.type),
    url: safePath(value.url),
    tag: text(value.tag),
  };
}

/** Only a path in this app survives; anything else goes to the chat. */
export function safePath(candidate: unknown): string {
  if (
    typeof candidate !== 'string' ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\')
  ) {
    return '/';
  }
  return candidate;
}
