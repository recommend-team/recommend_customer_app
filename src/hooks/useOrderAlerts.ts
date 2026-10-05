import { useEffect } from 'react';
import { chatClient } from '../lib/socket';
import { existingSubscription } from '../lib/push';
import { CHIMING_TYPES } from '../lib/alerts';
import { armChime, playChime } from '../components/pwa/chime';

/**
 * Order news, while the app is open: the chime.
 *
 * Driven by the chat message itself, as it arrives live — the server marks the ones that
 * are order news (`alert`). It used to be driven by push, which meant no sound at all for a
 * buyer who had not allowed notifications, or with no service worker running (as in dev).
 * Push is now only for when the app is closed; the service worker still forwards a push
 * that lands while the app is open, but that is no longer what chimes, so one piece of
 * news cannot chime twice. Replies never chime — see `CHIMING_TYPES`.
 *
 * Also keeps this device registered: a buyer who allowed notifications once is
 * re-registered on every connect, so a device the server forgot (a new session, a pruned
 * endpoint) starts receiving again without asking twice.
 */
export function useOrderAlerts(connected: boolean): void {
  useEffect(() => armChime(), []);

  useEffect(
    () =>
      chatClient.onLiveMessage((message) => {
        if (message.alert && CHIMING_TYPES.has(message.alert)) playChime();
      }),
    [],
  );

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
