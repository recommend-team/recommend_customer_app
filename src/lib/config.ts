/**
 * Environment, validated once at startup.
 *
 * A missing API URL would otherwise surface much later as a socket that never connects,
 * which reads as a broken chat rather than a missing variable. Failing here is louder
 * and far easier to diagnose.
 *
 * Everything prefixed `VITE_` is baked into the bundle at build time and is therefore
 * public. No secret belongs in this file or in `.env`.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in — see README.`,
    );
  }
  return value.replace(/\/$/, '');
}

export const config = {
  /** REST base, including the version prefix. */
  apiBaseUrl: required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL),
  /** Socket.IO origin. The /chat namespace is appended by the socket client. */
  socketUrl: required('VITE_SOCKET_URL', import.meta.env.VITE_SOCKET_URL),
  /** Optional — error tracking is skipped when absent. */
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  isDev: import.meta.env.DEV,
} as const;
