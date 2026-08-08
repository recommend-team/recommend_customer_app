import { ChatScreen } from './components/chat/ChatScreen';

/**
 * The chat is the app. There is deliberately no router yet — menus, cart and checkout
 * all open over the conversation rather than navigating away from it, so routes would
 * only be needed for the Paystack return (F3) and order history (F4).
 */
export function App() {
  return (
    // Centred and width-capped so the phone layout still reads well on a desktop browser.
    <div className="mx-auto h-full max-w-md bg-[var(--color-cream)] shadow-xl">
      <ChatScreen />
    </div>
  );
}
