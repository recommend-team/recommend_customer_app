import { io, type Socket } from 'socket.io-client';
import { config } from './config';
import { getToken, setToken } from './session';
import { CHAT_NAMESPACE } from './contract';
import type {
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

/**
 * The chat connection.
 *
 * Framework-agnostic — no React, no DOM beyond `localStorage` via `session`. A future
 * native app reuses this file as-is.
 *
 * Two things here are not obvious and both come from the server's behaviour:
 *
 * 1. `session` is emitted once during connection setup and can be missed if listeners
 *    attach late. `session:get` is requested on every connect so the token is never lost.
 * 2. The server does **not** echo the buyer's own message back. The caller renders it
 *    optimistically; only assistant replies arrive over the wire.
 */
export class ChatClient {
  private socket: Socket | null = null;
  private handlers: ChatClientHandlers = {};

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

    this.socket.on('chat:message', (message: ChatMessage) =>
      this.handlers.onMessage?.(message),
    );
    this.socket.on('chat:history', (data: { messages: ChatMessage[] }) =>
      this.handlers.onHistory?.(data?.messages ?? []),
    );
    this.socket.on('chat:typing', (data: { isTyping: boolean }) =>
      this.handlers.onTyping?.(Boolean(data?.isTyping)),
    );
    this.socket.on('chat:error', (error: ChatError) =>
      this.handlers.onError?.(error),
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

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

/**
 * Stable per-send id so a retry over a flaky connection is stored once and answered
 * once. `crypto.randomUUID` is unavailable on insecure origins, hence the fallback.
 */
function newClientMessageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const chatClient = new ChatClient();
