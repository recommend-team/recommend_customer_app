/**
 * The device session token.
 *
 * This token *is* the buyer's identity — there is no login. It owns the conversation and
 * the order history, so losing it means losing both, with no way to recover them: the
 * phone number they typed is unverified, so the server cannot hand history back on the
 * strength of it.
 *
 * Deliberately synchronous and storage-only. Nothing here talks to the network.
 */

const STORAGE_KEY = 'recommend.session.token';

/** Some browsers throw on localStorage in private mode rather than returning null. */
function safeStorage(): Storage | null {
  try {
    const probe = '__recommend_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** In-memory fallback so a private-mode buyer still gets a working session per tab. */
let memoryToken: string | null = null;

export function getToken(): string | null {
  const storage = safeStorage();
  if (!storage) return memoryToken;
  return storage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  memoryToken = token;
  safeStorage()?.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  memoryToken = null;
  safeStorage()?.removeItem(STORAGE_KEY);
}

/** True when this device has never connected — used to decide whether to expect a greeting. */
export function isNewDevice(): boolean {
  return getToken() === null;
}
