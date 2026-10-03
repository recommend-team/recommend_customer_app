/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { SW_PUSH_RECEIVED, parsePush, type BuyerPush } from './lib/alerts';

/**
 * The customer app's service worker.
 *
 * Ours rather than the one `vite-plugin-pwa` generates, so it can receive push — "your
 * order is on its way" for a buyer who has put the phone down. Everything the generated
 * worker did, this one still does.
 */

declare const self: ServiceWorkerGlobalScope;

// ─── What the generated worker did ────────────────────────────────────────────

// The app shell. The chat is realtime and the catalogue changes; nothing else is
// precached.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api/],
  }),
);

// Storefronts, briefly — the network first, a five-minute copy if it is unreachable.
registerRoute(
  ({ url }) => /\/api\/v1\/store/.test(url.href),
  new NetworkFirst({
    cacheName: 'catalogue',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })],
  }),
);

// `registerType: 'prompt'`: a new version waits for `UpdateToast`, rather than reloading a
// buyer mid-payment.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// ─── Push ─────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  event.waitUntil(deliver(parsePush(readJson(event.data))));
});

/**
 * In front of the buyer: the chat already shows the message over its socket, so the page
 * only needs to know — it may chime. Otherwise the system notification is the alert.
 *
 * Chrome accepts a push that shows no notification only while a page of ours is visible,
 * which is exactly the case where none is shown.
 */
async function deliver(push: BuyerPush): Promise<void> {
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  const visible = windows.filter(
    (client) => client.visibilityState === 'visible',
  );

  if (visible.length > 0) {
    for (const client of visible) {
      client.postMessage({ type: SW_PUSH_RECEIVED, push });
    }
    return;
  }

  await self.registration.showNotification(push.title, {
    body: push.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: push.url },
    ...(push.tag ? { tag: push.tag } : {}),
  });
}

function readJson(data: PushMessageData | null): unknown {
  if (!data) return null;
  try {
    return data.json();
  } catch {
    return { body: data.text() };
  }
}

// ─── Tapping a notification ───────────────────────────────────────────────────

/** Everything about an order lives in the conversation, so a tap always opens the chat. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url } = parsePush(event.notification.data);
  event.waitUntil(open(url));
});

async function open(path: string): Promise<void> {
  const windows = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  const existing = windows[0];

  if (existing) {
    await existing.focus();
    return;
  }
  await self.clients.openWindow(path);
}
