import { useEffect } from 'react';
import { chatClient } from '../lib/socket';
import { existingSubscription } from '../lib/push';
import { CHIMING_TYPES, SW_PUSH_RECEIVED } from '../lib/alerts';
import { armChime, playChime } from '../components/pwa/chime';

/**
 * Order notifications, while the app is open.
 *
 * The chat already shows every update over its socket; what the open app adds is the
 * sound. A push that arrives while the buyer is looking is handed to the page by the
 * service worker, and order news chimes. Replies never do — see `CHIMING_TYPES`.
 *
 * Also keeps this device registered: a buyer who allowed notifications once is
 * re-registered on every connect, so a device the server forgot (a new session, a
 * pruned endpoint) starts receiving again without asking twice.
 */
export function useOrderAlerts(connected: boolean): void {
  useEffect(() => armChime(), []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        push?: { type?: unknown };
      } | null;
      if (data?.type !== SW_PUSH_RECEIVED) return;
      if (
        typeof data.push?.type === 'string' &&
        CHIMING_TYPES.has(data.push.type)
      ) {
        playChime();
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;

    void existingSubscription().then((subscription) => {
      if (subscription && !cancelled)
        void chatClient.registerPush(subscription);
    });

    return () => {
      cancelled = true;
    };
  }, [connected]);
}
