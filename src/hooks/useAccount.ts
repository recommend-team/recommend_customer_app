import { useEffect, useState } from 'react';
import { chatClient } from '../lib/socket';

export interface UseAccount {
  /** The verified email this browser is signed in with, or null for a guest. */
  email: string | null;
  /** False until the server has answered — so nothing flashes "Sign in" to a signed-in buyer. */
  known: boolean;
}

/**
 * Who this browser is signed in as, kept current through sign-in and sign-out.
 *
 * Asks on mount as well as listening: the answer sent on connect has usually come and
 * gone by the time a menu or sheet mounts.
 */
export function useAccount(): UseAccount {
  const [state, setState] = useState<UseAccount>({ email: null, known: false });

  useEffect(() => {
    const unsubscribe = chatClient.onAccountEvents({
      onAccount: (email) => setState({ email, known: true }),
    });
    chatClient.requestAccount();
    return unsubscribe;
  }, []);

  return state;
}
