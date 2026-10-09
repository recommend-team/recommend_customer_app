import { useCallback, useEffect, useRef, useState } from 'react';
import { chatClient } from '../lib/socket';
import type { ChatError, ChatMessage } from '../lib/contract';

/**
 * All the chat state, and the only React-aware part of the chat plumbing.
 *
 * `lib/socket.ts` stays framework-agnostic so a native app can reuse it; this hook is the
 * thin adapter between that and components.
 */

export interface UseChat {
  messages: ChatMessage[];
  connected: boolean;
  typing: boolean;
  error: ChatError | null;
  /** True while an older page is in flight, so the thread can show a spinner. */
  loadingOlder: boolean;
  /** False once the server returns a short page — there is nothing further back. */
  hasMore: boolean;
  send: (text: string) => void;
  /** Answer the add-on card. `said` is the buyer's side of it, e.g. "Add 2 × Water". */
  answerAddOns: (
    items: { productId: string; quantity: number }[],
    said: string,
  ) => void;
  loadOlder: () => void;
  dismissError: () => void;
}

const PAGE_SIZE = 30;

export function useChat(): UseChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  /**
   * Which kind of history response to expect. The contract has one `chat:history` event
   * for both the initial load and scroll-back, so the request has to be remembered.
   */
  const pending = useRef<'initial' | 'older' | null>(null);

  useEffect(() => {
    chatClient.connect({
      onConnectionChange: (isConnected) => {
        setConnected(isConnected);
        // "Typing…" is the server's to switch off, and a dropped connection loses that
        // signal — the dots would stay forever. Clear them on any change: a reply still
        // being written arrives as a message all the same.
        setTyping(false);
        if (isConnected) {
          // The server is authoritative on reconnect: pull the thread rather than
          // trusting whatever this tab still holds.
          pending.current = 'initial';
          chatClient.requestHistory(undefined, PAGE_SIZE);
        }
      },

      onTyping: setTyping,
      onError: setError,

      onMessage: (message) =>
        setMessages((current) =>
          // A reconnect can re-deliver; never show the same message twice.
          current.some((m) => m.id === message.id)
            ? current
            : [...current, message],
        ),

      onHistory: (page) => {
        const mode = pending.current;
        pending.current = null;

        if (mode === 'older') {
          setLoadingOlder(false);
          // A short page means we have reached the beginning of the conversation.
          if (page.length < PAGE_SIZE) setHasMore(false);
          setMessages((current) => dedupe([...page, ...current]));
          return;
        }

        // Initial load, or a reconnect. Replacing also discards any optimistic message
        // the server never received — which is correct, it was never sent.
        if (page.length < PAGE_SIZE) setHasMore(false);
        setMessages(page);
      },
    });

    return () => chatClient.disconnect();
  }, []);

  // The buyer's own turn, shown immediately — the server deliberately does not echo it
  // back, so nothing else will render it.
  const showOwn = useCallback((text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        author: 'BUYER',
        text,
        payload: null,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      showOwn(trimmed);
      chatClient.send(trimmed);
    },
    [showOwn],
  );

  const answerAddOns = useCallback(
    (items: { productId: string; quantity: number }[], said: string) => {
      // Worded as the server records it, so history reads the same after a reload.
      showOwn(said);
      chatClient.addAddOns(items);
    },
    [showOwn],
  );

  const loadOlder = useCallback(() => {
    if (loadingOlder || !hasMore) return;

    const oldest = messages.find((message) => !message.id.startsWith('local-'));
    if (!oldest) return;

    setLoadingOlder(true);
    pending.current = 'older';
    chatClient.requestHistory(oldest.createdAt, PAGE_SIZE);
  }, [loadingOlder, hasMore, messages]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    messages,
    connected,
    typing,
    error,
    loadingOlder,
    hasMore,
    send,
    answerAddOns,
    loadOlder,
    dismissError,
  };
}

function dedupe(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}
