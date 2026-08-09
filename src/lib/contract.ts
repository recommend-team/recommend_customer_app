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
}

/** Client → server. */
export interface ClientEvents {
  'session:get': (body: Record<string, never>) => void;
  'chat:message': (body: SendMessage) => void;
  'chat:history': (body: { before?: string; limit?: number }) => void;
  'checkout:start': (body: StartCheckout) => void;
  'orders:list': (body: Record<string, never>) => void;
  'orders:complete': (body: { reference: string }) => void;
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
  vendors: {
    vendorName: string | null;
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
