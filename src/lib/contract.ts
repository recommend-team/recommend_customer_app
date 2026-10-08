/**
 * The backend contract, mirrored from `recommend-be` §6 (FROZEN v1).
 */

// ─── Socket events ────────────────────────────────────────────────────────────

export const CHAT_NAMESPACE = '/chat';

/** Server → client. */
export interface ServerEvents {
  session: (data: SessionIssued) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:typing': (data: { isTyping: boolean }) => void;
  'chat:history': (data: { messages: ChatMessage[] }) => void;
  'chat:error': (error: ChatError) => void;
  'orders:list': (data: { orders: BuyerOrder[] }) => void;
  /** Answer to `push:subscribe`. */
  'push:subscribed': (data: { ok: boolean }) => void;
  /** Who this browser is signed in as — after `account:get`, a sign-in or a sign-out. */
  account: (data: { email: string | null }) => void;
  'account:code-sent': (data: { email: string; resendAfter: number }) => void;
  'account:error': (error: AccountError) => void;
}

/** Why a sign-in step failed. `message` is written for the buyer. */
export interface AccountError {
  code:
    | 'INVALID_EMAIL'
    | 'COOLDOWN'
    | 'TOO_MANY'
    | 'SEND_FAILED'
    | 'WRONG_CODE'
    | 'CODE_EXPIRED'
    | 'TOO_MANY_ATTEMPTS';
  message: string;
  retryAfter?: number;
  attemptsLeft?: number;
}

/** Client → server. */
export interface ClientEvents {
  'session:get': (body: Record<string, never>) => void;
  'chat:message': (body: SendMessage) => void;
  'chat:history': (body: { before?: string; limit?: number }) => void;
  'checkout:start': (body: StartCheckout) => void;
  'orders:list': (body: Record<string, never>) => void;
  'orders:complete': (body: { reference: string }) => void;
  /** Register this device for order notifications (N4). */
  'push:subscribe': (body: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent: string;
  }) => void;
  'push:unsubscribe': (body: { endpoint: string }) => void;
  'account:get': (body: Record<string, never>) => void;
  'account:request-code': (body: { email: string }) => void;
  /**
   * On success the server may move this browser onto the account's conversation: a new
   * `session` token, then `account`, then that thread in `chat:history`.
   */
  'account:verify': (body: { email: string; code: string }) => void;
  /** This browser only: back to a fresh guest chat. */
  'account:sign-out': (body: Record<string, never>) => void;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'READY'
  | 'DISPATCHED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface BuyerOrder {
  reference: string;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  deliveryAddress: string | null;
  goodsTotal: number;
  deliveryFee: number;
  totalAmount: number;
  /** True only when confirming receipt is the buyer's next move. Decided server-side. */
  canComplete: boolean;
  /**
   * The code to show — to the rider on a delivery, at the counter on a pickup. Null except
   * while someone is waiting to check it.
   */
  handoverCode: string | null;
  /** Who is bringing it, so the buyer can call them. Only once it is on its way. */
  rider: { name: string; phone: string | null } | null;
  vendors: {
    vendorName: string | null;
    /** Where to collect from. Pickup orders only, once paid. */
    pickupAddress: string | null;
    status: OrderStatus;
    items: { name: string; quantity: number; lineTotal: number }[];
  }[];
}

export interface SessionIssued {
  token: string;
  sessionId: string;
}

export interface SendMessage {
  text: string;
  /** De-duplicates retries — the same id is stored once and answered once. */
  clientMessageId: string;
  /** Display context only. The server never prices from this. */
  cart?: { itemCount: number; vendorCount: number };
}

export interface StartCheckout {
  items: { productId: string; quantity: number; expectedUnitPrice?: number }[];
  /** What to show as the buyer's turn. Defaults server-side to "I'd like to pay". */
  text?: string;
}

export type ChatErrorCode =
  | 'NO_SESSION'
  | 'NO_CONVERSATION'
  | 'RATE_LIMITED'
  | 'REPLY_FAILED'
  | 'CHECKOUT_FAILED'
  | 'CONNECTION_FAILED';

export interface ChatError {
  code: ChatErrorCode;
  message: string;
  /** Seconds, on RATE_LIMITED only. */
  retryAfter?: number;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export type MessageAuthor = 'BUYER' | 'ASSISTANT' | 'SYSTEM';

export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  text: string;
  payload: MessagePayload | null;
  createdAt: string;
  /**
   * Set on a live message that is order news (`ORDER_DISPATCHED`, …), so the open app can
   * chime. Never set on history — an old message does not chime again.
   */
  alert?: string | null;
}

/**
 * The structured half of a reply. `text` always carries a plain-language fallback, so a
 * payload kind this client does not know how to render still says something coherent.
 */
export type MessagePayload =
  | { kind: 'text'; data?: Record<string, unknown> }
  | { kind: 'vendor_list'; data: VendorListData }
  | { kind: 'product_list'; data: ProductListData }
  | { kind: 'choices'; data: ChoicesData }
  | { kind: 'order_summary'; data: OrderSummaryData }
  | { kind: 'payment_link'; data: PaymentLinkData };

export interface VendorListData {
  vendors: {
    id: string;
    name: string;
    slug: string | null;
    category: string | null;
    isOpen: boolean;
    logoUrl: string | null;
    areas: string[];
  }[];
}

export interface ProductListData {
  vendors: {
    vendorId: string;
    vendorName: string | null;
    /** Opens the vendor menu via GET /store/:slug. */
    vendorSlug: string | null;
    items: {
      id: string;
      name: string;
      /** Always from the database. The assistant is forbidden to state a price in text. */
      price: number;
      imageUrl: string | null;
    }[];
  }[];
}

export interface ChoicesData {
  purpose: 'area' | 'fulfillment' | 'confirm' | string;
  options: { id: string; label: string }[];
}

export interface OrderSummaryData {
  status: 'PENDING_CONFIRMATION' | 'PAID' | string;
  reference?: string;
  goodsTotal?: number;
  deliveryFee?: number;
  totalAmount?: number;
  fulfillmentType?: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  /** Present before payment. */
  items?: {
    name: string;
    vendorName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  /** Present after payment, grouped by vendor — one entry per order actually placed. */
  vendors?: {
    orderId: string;
    vendorName?: string | null;
    /** This vendor's goods subtotal, delivery excluded. */
    subtotal?: number;
    items: {
      name: string;
      quantity: number;
      /** Snapshots taken at purchase, not today's catalogue price. */
      unitPrice?: number;
      lineTotal?: number;
    }[];
  }[];
}

export interface CheckoutStatus {
  reference: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED' | 'REFUNDED' | string;
  paidAt: string | null;
  goodsTotal: number;
  deliveryFee: number;
  totalAmount: number;
  fulfillmentType: string;
  createdAt: string;
  vendors: {
    status: string;
    items: { name: string; quantity: number; unitPrice: number }[];
  }[];
}

export interface PaymentLinkData {
  reference: string;
  /** With publicKey, opens Paystack Inline over the chat — no navigation away. */
  accessCode: string;
  publicKey: string | null;
  /** Fallback for clients that cannot open inline. */
  authorizationUrl: string;
  goodsTotal: number;
  deliveryFee: number;
  totalAmount: number;
}

// ─── REST ─────────────────────────────────────────────────────────────────────

export interface StoreSummary {
  id: string;
  businessName: string | null;
  businessDescription: string | null;
  businessCategory: string | null;
  serviceAreas: { id: string; name: string }[];
  businessLogoUrl: string | null;
  slug: string | null;
  isOpen: boolean;
}

export interface StorefrontResponse {
  vendor: StoreSummary & {
    businessBannerUrl: string | null;
    whatsappNumber: string | null;
    operatingHours: Record<string, unknown> | null;
  };
  products: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
  }[];
}

/** Every response is wrapped by the backend's global interceptor. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}
