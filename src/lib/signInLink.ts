/**
 * `/?signin=<email>` — where the website's "Follow your order" button and the order
 * emails send a storefront buyer. Their order is already in the chat that email owns;
 * signing in with it brings them there.
 *
 * Read once, as the app loads, and taken out of the address bar straight away so a
 * refresh, a shared link or an installed home-screen icon never carries it again.
 */
export const SIGN_IN_EMAIL: string | null = takeSignInEmail();

function takeSignInEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('signin');
    if (raw === null) return null;

    url.searchParams.delete('signin');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );

    const email = raw.trim().toLowerCase();
    // Only a prefill — the server checks it properly when a code is asked for.
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? email
      : null;
  } catch {
    return null;
  }
}
