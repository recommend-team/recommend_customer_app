# Recommend — Customer App

The PWA customers use to buy from local vendors by chatting.

Vendors sell whatever they sell — cooked food, gadgets, appliances. Nothing in this app
assumes a category; the first vertical is restaurants, and no code says so.

**Everything happens inside the conversation.** No store page, no checkout page, no
redirect to Paystack. Menus and cart open as sheets over the chat, the bot collects
contact details as ordinary chat turns, and payment opens inline. This is the WhatsApp
in-app browser model: the thread is the app.

## Running it

```bash
cp .env.example .env     # already done if you cloned with one
pnpm install
pnpm dev                 # http://localhost:5173
```

**A backend must be reachable.** Run `recommend-be` locally, or point `VITE_*` at
staging. The backend allowlists `localhost:5173` for both the REST API and the Socket.IO
handshake — see `recommend-be/src/config/cors.ts`.

Discovery needs seeded vendors with products and service areas, otherwise a working app
correctly answers "I couldn't find anything."

## Environment

Everything prefixed `VITE_` is **baked into the bundle at build time and is public**.
No secret belongs in `.env`.

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | REST base, including the version prefix |
| `VITE_SOCKET_URL` | Socket.IO origin — `/chat` is appended by the client |
| `VITE_SENTRY_DSN` | Optional; tracking is skipped when absent |

Config is validated at startup, so a missing variable fails loudly instead of surfacing
later as a socket that never connects.

## Structure

```
src/
  lib/          framework-agnostic — moves to React Native untouched
    contract.ts   the backend's FROZEN v1 socket + REST types
    config.ts     validated environment
    session.ts    the device token
    socket.ts     connect, reconnect, de-duplication
    api.ts        REST client
  components/   web-specific rendering — rewritten for native
```

**Nothing in `lib/` may import from `components/`.** The protocol, session handling and
cart maths are the hard parts and none of them need a DOM; keeping that boundary is what
makes a future native app a port rather than a rewrite.

## Two things about the contract

**The server never echoes your own message back.** Only assistant replies arrive over the
wire, so the buyer's message is rendered optimistically on send.

**The session token is the buyer's identity.** There is no login. It owns the conversation
and the order history — lose it and both are gone, because the phone number the buyer
typed is unverified and the server cannot safely hand history back on the strength of it.

## Still needed

- **Icons** — placeholder orange tiles are generated and wired up, including a maskable
  variant, so the manifest is valid and the app installs. **Replace them with real
  branding**: `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, and
  `public/favicon.svg`. Keep the maskable one padded — Android crops it to a circle and
  clips anything near the edge.
- **Payload cards** — `vendor_list` and `product_list` land in F2, `order_summary` and
  `payment_link` in F3. Until then they render a small marker, so it is visible that they
  arrived.
- **Hosting** — undecided. A service worker requires HTTPS; `localhost` is exempt, a
  plain-HTTP preview host is not
