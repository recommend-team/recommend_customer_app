import { api } from './api';

/**
 * Web push for a buyer: "tell me when it's on its way".
 *
 * The subscription is registered over the chat socket, not REST — the device session that
 * owns the conversation is the buyer's only identity, and the socket is where it is
 * proven. See `chatClient.registerPush`.
 *
 * Everything here degrades rather than throws. A refused permission, an unsupported
 * browser or a server without VAPID keys all end with the buyer simply not notified; the
 * chat thread still holds every update.
 */

export type PushState =
  /** No service worker or no push — an old browser, or an iPhone that has not installed. */
  | 'unsupported'
  /** The server has no VAPID keys. */
  | 'unconfigured'
  | 'available'
  | 'granted'
  /** Refused. Browsers do not ask again. */
  | 'denied';

export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function publicKey(): Promise<string | null> {
  try {
    return (await api.pushPublicKey())?.publicKey ?? null;
  } catch {
    return null;
  }
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (!(await publicKey())) return 'unconfigured';
  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    // Granted but unsubscribed reads as "on" and delivers nothing.
    return (await registration.pushManager.getSubscription())
      ? 'granted'
      : 'available';
  }
  return 'available';
}

/**
 * Ask, and subscribe this browser. Call from a tap, never on load — browsers ask once and
 * remember a refusal for good. Returns the subscription to register, or the reason there
 * is none.
 */
export async function subscribeBrowser(): Promise<
  | { state: 'granted'; subscription: PushSubscriptionBody }
  | { state: PushState }
> {
  if (!pushSupported()) return { state: 'unsupported' };

  const key = await publicKey();
  if (!key) return { state: 'unconfigured' };

  if ((await Notification.requestPermission()) !== 'granted') {
    return { state: 'denied' };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(key),
    }));

  const body = toBody(subscription);
  return body
    ? { state: 'granted', subscription: body }
    : { state: 'available' };
}

/**
 * This browser's existing subscription, if permission was granted earlier. Re-registered
 * on every connect, so a buyer who subscribed once keeps receiving even if the server
 * forgot the device.
 */
export async function existingSubscription(): Promise<PushSubscriptionBody | null> {
  if (!pushSupported() || Notification.permission !== 'granted') return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? toBody(subscription) : null;
  } catch {
    return null;
  }
}

function toBody(subscription: PushSubscription): PushSubscriptionBody | null {
  const json = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent.slice(0, 300),
  };
}

/** VAPID keys travel as base64url; `PushManager` wants raw bytes. */
export function base64UrlToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
