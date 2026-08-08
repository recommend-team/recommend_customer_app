import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { useCart } from '../../hooks/useCart';
import { chatClient } from '../../lib/socket';
import { AppHeader } from '../layout/AppHeader';
import { BottomNav } from '../layout/BottomNav';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { TypingIndicator } from './TypingIndicator';
import { DateDivider, sameDay } from './DateDivider';
import { VendorSheet } from '../store/VendorSheet';
import { CartBar } from '../cart/CartBar';
import { CartSheet } from '../cart/CartSheet';

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

  /** Which vendor's menu is open over the conversation, if any. */
  const [vendor, setVendor] = useState<{
    slug: string;
    name: string | null;
  } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const restoreFrom = useRef<number | null>(null);
  /** Has the thread been dropped at the newest message yet? */
  const pinned = useRef(false);

  /**
   * A refresh — or a buyer coming back to the page — must land on the newest message.
   *
   * History arrives as one tall batch while the thread is still at `scrollTop` 0, so the
   * "near the bottom" test below would read the whole thread as distance and refuse to
   * follow. The first jump therefore has to be unconditional, and has to happen before
   * paint, or the buyer watches the top of their own history flash past.
   */
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

  return (
    // `relative` so the sheets can cover the conversation without covering the page.
    <div className="relative flex h-full flex-col overflow-hidden">
      <AppHeader connected={connected} />

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
                onChoose={send}
                onOpenVendor={(slug, name) => setVendor({ slug, name })}
              />
            </div>
          );
        })}

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
        <CartBar onOpen={() => setCartOpen(true)} />
        <Composer disabled={!connected} onSend={send} />
      </div>

      <BottomNav
        active={cartOpen ? 'cart' : 'chat'}
        cartCount={cart.itemCount}
        onSelect={(tab) => {
          if (tab === 'chat') setCartOpen(false);
          if (tab === 'cart') setCartOpen(true);
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
    </div>
  );
}
