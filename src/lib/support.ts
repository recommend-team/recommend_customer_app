/**
 * How a buyer reaches a person, and where the answers live.
 *
 * `VITE_SUPPORT_PHONE` and `VITE_SUPPORT_EMAIL` override the defaults. Baked in at build
 * time, so a change needs a redeploy. The backend (`SUPPORT_*`) and the website
 * (`NEXT_PUBLIC_SUPPORT_*`) carry the same defaults; keep all three the same.
 */

const DEFAULT_SUPPORT_PHONE = '+234 814 306 7676';
const DEFAULT_SUPPORT_EMAIL = 'contacts.recommend@gmail.com';

export const SUPPORT_PHONE =
  (import.meta.env.VITE_SUPPORT_PHONE as string | undefined)?.trim() ||
  DEFAULT_SUPPORT_PHONE;
export const SUPPORT_PHONE_HREF = `tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`;
export const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() ||
  DEFAULT_SUPPORT_EMAIL;
export const SUPPORT_HOURS = 'Mon–Fri 8am–9pm · Sat 9am–8pm';

/**
 * The public website. Optional: unset falls back to the staging site, which carries the
 * same questions and answers. Set `VITE_SITE_URL` for production.
 */
const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ||
  'https://recommend-fe.vercel.app'
).replace(/\/$/, '');

export const FAQ_URL = `${SITE_URL}/#faq`;
