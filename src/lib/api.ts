import { config } from './config';
import type { ApiEnvelope, StoreSummary, StorefrontResponse } from './contract';

/**
 * REST client for everything that is not the conversation.
 *
 * Every backend response is wrapped by a global interceptor, so `data` is unwrapped
 * here and callers never see the envelope.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Extra fields the backend attached — e.g. `code` and `changes` on a 409. */
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  const body = (await response.json().catch(() => null)) as
    (ApiEnvelope<T> & Record<string, unknown>) | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body?.message as string) ?? `Request failed (${response.status})`,
      body ?? undefined,
    );
  }

  return body?.data as T;
}

export const api = {
  /** Approved storefronts, paginated. */
  listStores: (page = 1, limit = 20) =>
    request<{ items: StoreSummary[]; total: number; totalPages: number }>(
      `/store?page=${page}&limit=${limit}`,
    ),

  /** One storefront and everything it currently sells. */
  getStorefront: (slug: string) =>
    request<StorefrontResponse>(`/store/${encodeURIComponent(slug)}`),

  /**
   * Order status by reference. Public because the buyer already holds the reference;
   * the backend returns no contact details.
   */
  getOrderStatus: (reference: string) =>
    request<Record<string, unknown>>(
      `/checkout/${encodeURIComponent(reference)}`,
    ),
};
