import { io, type Socket } from 'socket.io-client';
import { config } from './config';
import { getToken, setToken } from './session';
import { CHAT_NAMESPACE } from './contract';
import type { PushSubscriptionBody } from './push';
import type {
  BuyerOrder,
  ChatError,
  ChatMessage,
  SendMessage,
  StartCheckout,
} from './contract';

export interface ChatClientHandlers {
  onMessage?: (message: ChatMessage) => void;
  onHistory?: (messages: ChatMessage[]) => void;
  onTyping?: (isTyping: boolean) => void;
  onError?: (error: ChatError) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class ChatClient {
  private socket: Socket | null = null;
  private handlers: ChatClientHandlers = {};

  private ordersHandler?: (orders: BuyerOrder[]) => void;

  /** Listeners for live messages, which survive `connect` like the orders handler. */
  private readonly liveListeners = new Set<(message: ChatMessage) => void>();

  /** Hear every message as it arrives live — never history. Returns an unsubscribe. */
  onLiveMessage(listener: (message: ChatMessage) => void): () => void {
    this.liveListeners.add(listener);
    return () => this.liveListeners.delete(listener);
  }

  connect(handlers: ChatClientHandlers = {}): void {
    this.handlers = handlers;
    if (this.socket?.connected) return;

    const token = getToken();

    this.socket = io(`${config.socketUrl}${CHAT_NAMESPACE}`, {
      transports: ['websocket'],
      // Absent or expired tokens are not refused — the server issues a fresh session.
      auth: token ? { token } : {},
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      this.handlers.onConnectionChange?.(true);
      // Ask explicitly rather than relying on the connect-time emit, which races with
      // listener attachment.
      this.socket?.emit('session:get', {});
    });

    this.socket.on('disconnect', () =>
      this.handlers.onConnectionChange?.(false),
    );

    this.socket.on('session', (data: { token: string }) => {
      if (data?.token) setToken(data.token);
    });

    this.socket.on('chat:message', (message: ChatMessage) => {
      this.handlers.onMessage?.(message);
      for (const listener of this.liveListeners) listener(message);
    });
    this.socket.on('chat:history', (data: { messages: ChatMessage[] }) =>
      this.handlers.onHistory?.(data?.messages ?? []),
    );
    this.socket.on('chat:typing', (data: { isTyping: boolean }) =>
      this.handlers.onTyping?.(Boolean(data?.isTyping)),
    );
    this.socket.on('chat:error', (error: ChatError) =>
      this.handlers.onError?.(error),
    );

    this.socket.on('orders:list', (data: { orders: BuyerOrder[] }) =>
      this.ordersHandler?.(data?.orders ?? []),
    );
  }

  send(text: string, cart?: SendMessage['cart']): string {
    const clientMessageId = newClientMessageId();
    this.socket?.emit('chat:message', { text, clientMessageId, cart });
    return clientMessageId;
  }

  /** Older messages, for scroll-back. Omit `before` for the most recent page. */
  requestHistory(before?: string, limit = 30): void {
    this.socket?.emit('chat:history', { before, limit });
  }

  startCheckout(body: StartCheckout): void {
    this.socket?.emit('checkout:start', body);
  }

  /** Attach the orders listener. Survives `connect`, unlike the chat handlers. */
  setOrdersHandler(handler?: (orders: BuyerOrder[]) => void): void {
    this.ordersHandler = handler;
  }

  /** Every order this device has placed. Answered with an `orders:list` event. */
  requestOrders(): void {
    this.socket?.emit('orders:list', {});
  }

  completeOrder(reference: string): void {
    this.socket?.emit('orders:complete', { reference });
  }

  registerPush(body: PushSubscriptionBody): Promise<boolean> {
    const socket = this.socket;
    if (!socket?.connected) return Promise.resolve(false);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        socket.off('push:subscribed', onAnswer);
        resolve(false);
      }, PUSH_ANSWER_TIMEOUT_MS);

      const onAnswer = (answer: { ok?: boolean }) => {
        clearTimeout(timer);
        resolve(answer?.ok === true);
      };

      socket.once('push:subscribed', onAnswer);
      socket.emit('push:subscribe', body);
    });
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

function newClientMessageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Long enough for a slow connection, short enough not to leave a button spinning. */
const PUSH_ANSWER_TIMEOUT_MS = 8_000;

export const chatClient = new ChatClient();
