import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useChat } from '../../hooks/useChat';
import { useCart } from '../../hooks/useCart';
import { chatClient } from '../../lib/socket';
import { AppHeader } from '../layout/AppHeader';
import { AppMenu } from '../layout/AppMenu';
import { BottomNav } from '../layout/BottomNav';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { TypingIndicator } from './TypingIndicator';
import { DateDivider, sameDay } from './DateDivider';
import { VendorSheet } from '../store/VendorSheet';
import { CartBar } from '../cart/CartBar';
import { CartSheet } from '../cart/CartSheet';
import { OrdersSheet } from '../orders/OrdersSheet';
import { InstallPrompt } from '../pwa/InstallPrompt';
import { OrderAlertsPrompt } from '../pwa/OrderAlertsPrompt';
import { useOrderAlerts } from '../../hooks/useOrderAlerts';
import { useAccount } from '../../hooks/useAccount';
import { SignInSheet } from '../account/SignInSheet';
import { UpdateToast } from '../pwa/UpdateToast';

/** Enough turns that the buyer has seen the app work before being asked to install it. */
const TURNS_BEFORE_INSTALL_PROMPT = 4;

export function ChatScreen() {
  const {
    messages,
    connected,
    typing,
    error,
    loadingOlder,
    hasMore,
    send,
    loadOlder,
    dismissError,
  } = useChat();
  const cart = useCart();
  useOrderAlerts(connected);

  /** Offer order notifications — set when a payment lands, the moment they matter. */
  const [offerAlerts, setOfferAlerts] = useState(false);
  const closeAlertsOffer = useCallback(() => setOfferAlerts(false), []);

  /** Which vendor's menu is open over the conversation, if any. */
  const [vendor, setVendor] = useState<{
    slug: string;
    name: string | null;
  } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const closeSignIn = useCallback(() => setSignInOpen(false), []);
  const account = useAccount();
  // A returning buyer on a new browser sees only the greeting — offer their old chat
  // back, until they say anything here.
  const offerSignIn =
    account.known &&
    !account.email &&
    !messages.some((message) => message.author === 'BUYER');

  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const restoreFrom = useRef<number | null>(null);
  /** Has the thread been dropped at the newest message yet? */
  const pinned = useRef(false);

  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread || pinned.current || messages.length === 0) return;

    pinned.current = true;
    thread.scrollTop = thread.scrollHeight;

    // Product cards and web fonts can settle a frame later and grow the thread under us.
    requestAnimationFrame(() => {
      const settled = threadRef.current;
      if (settled) settled.scrollTop = settled.scrollHeight;
    });
  }, [messages]);

  // Only follow new messages when the buyer is already near the bottom — yanking them
  // down mid scroll-back would be worse than missing one.
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread || restoreFrom.current !== null) return;

    const distanceFromBottom =
      thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    if (distanceFromBottom < 160) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages, typing]);

  // Keep the same message under the buyer's thumb after older ones load above it.
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread || restoreFrom.current === null) return;

    thread.scrollTop = thread.scrollHeight - restoreFrom.current;
    restoreFrom.current = null;
  }, [messages]);

  const { liveMessageIds, paidReferences } = useMemo(() => {
    let summary: string | null = null;
    let payment: string | null = null;
    const paid = new Set<string>();

    for (const message of messages) {
      const payload = message.payload;

      if (payload?.kind === 'order_summary') {
        const settled = payload.data.status === 'PAID';
        if (settled && payload.data.reference) paid.add(payload.data.reference);
        summary = settled ? null : message.id;
      }

      if (payload?.kind === 'payment_link') {
        summary = null;
        payment = message.id;
      }
    }

    return {
      liveMessageIds: new Set(
        [summary, payment].filter((id): id is string => !!id),
      ),
      paidReferences: paid,
    };
  }, [messages]);

  const onScroll = () => {
    const thread = threadRef.current;
    if (!thread || thread.scrollTop > 60 || loadingOlder || !hasMore) return;

    restoreFrom.current = thread.scrollHeight - thread.scrollTop;
    loadOlder();
  };

  /**
   * Hand the cart to the server and let the conversation take over — the bot collects
   * name, phone and fulfillment as ordinary chat turns from here.
   */
  const startCheckout = () => {
    chatClient.startCheckout({ items: cart.toCheckoutItems() });
    setCartOpen(false);
  };

  const { clear: emptyCart } = cart;
  const clearPaidCart = useCallback(() => emptyCart(), [emptyCart]);

  const seenPaid = useRef<Set<string> | null>(null);

  useEffect(() => {
    // History has not arrived yet; seeding now would treat old orders as new.
    if (messages.length === 0) return;

    if (seenPaid.current === null) {
      seenPaid.current = new Set(paidReferences);
      return;
    }

    let landed = false;
    for (const reference of paidReferences) {
      if (!seenPaid.current.has(reference)) {
        seenPaid.current.add(reference);
        landed = true;
      }
    }

    if (landed) {
      emptyCart();
      setOfferAlerts(true);
    }
  }, [messages.length, paidReferences, emptyCart]);

  return (
    // `relative` so the sheets can cover the conversation without covering the page.
    <div className="relative flex h-full flex-col overflow-hidden">
      <AppHeader connected={connected} onMenu={() => setMenuOpen(true)} />

      <div
        ref={threadRef}
        onScroll={onScroll}
        className="thread-bg flex-1 space-y-2.5 overflow-y-auto px-3.5 py-4"
      >
        {loadingOlder && (
          <p className="py-1 text-center text-[11px] text-[var(--color-ink)]/40">
            Loading earlier messages…
          </p>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const showDivider =
            !previous ||
            !sameDay(new Date(previous.createdAt), new Date(message.createdAt));

          return (
            <div key={message.id} className="space-y-2.5">
              {showDivider && <DateDivider iso={message.createdAt} />}
              <MessageBubble
                message={message}
                live={liveMessageIds.has(message.id)}
                paidReferences={paidReferences}
                onChoose={send}
                onOpenVendor={(slug, name) => setVendor({ slug, name })}
                onPaid={clearPaidCart}
              />
            </div>
          );
        })}

        {offerSignIn && (
          <p className="px-1 text-center text-[12px] text-[var(--color-ink)]/55">
            Chatted with us before?{' '}
            <button
              onClick={() => setSignInOpen(true)}
              className="font-bold text-[var(--color-orange)] underline-offset-2 active:underline"
            >
              Sign in
            </button>{' '}
            to see it here.
          </p>
        )}

        {typing && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {error && (
        <button
          onClick={dismissError}
          className="bg-amber-50 px-4 py-2 text-left text-xs text-amber-900"
        >
          {error.message}
          {error.retryAfter ? ` (about ${error.retryAfter}s)` : ''}
          <span className="ml-1 text-amber-700/60">— tap to dismiss</span>
        </button>
      )}

      <div className="bg-[var(--color-cream-deep)] pt-1">
        <OrderAlertsPrompt visible={offerAlerts} onDone={closeAlertsOffer} />
        {/* One ask at a time — the alerts offer covers installing on iPhone itself. */}
        <InstallPrompt
          visible={
            !offerAlerts && messages.length >= TURNS_BEFORE_INSTALL_PROMPT
          }
        />
        <CartBar onOpen={() => setCartOpen(true)} />
        <Composer disabled={!connected} onSend={send} />
      </div>

      <UpdateToast />

      <BottomNav
        active={cartOpen ? 'cart' : ordersOpen ? 'orders' : 'chat'}
        cartCount={cart.itemCount}
        onSelect={(tab) => {
          setCartOpen(tab === 'cart');
          setOrdersOpen(tab === 'orders');
        }}
      />

      <VendorSheet
        slug={vendor?.slug ?? null}
        fallbackName={vendor?.name ?? null}
        onClose={() => setVendor(null)}
      />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={startCheckout}
      />

      <OrdersSheet open={ordersOpen} onClose={() => setOrdersOpen(false)} />
      <AppMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSignIn={() => {
          setMenuOpen(false);
          setSignInOpen(true);
        }}
      />
      <SignInSheet open={signInOpen} onClose={closeSignIn} />
    </div>
  );
}
