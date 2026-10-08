/**
 * How a buyer reaches a person, and where the answers live. The same details the
 * website's contact page shows — `recommend-fe` → `ContactContent.tsx`.
 */

export const SUPPORT_PHONE = '+234 814 306 7676';
export const SUPPORT_PHONE_HREF = 'tel:+2348143067676';
export const SUPPORT_EMAIL = 'contacts.recommend@gmail.com';
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
