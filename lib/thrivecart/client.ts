import { thrivecartConfig } from './config';
import type { ThriveCartApiCustomer, ThriveCartApiResponse } from './types';

const RATE_LIMIT_DELAY_MS = 1100; // ~55 requests/minute (safe margin under 60/min limit)

/**
 * Make an authenticated request to the ThriveCart API.
 */
async function thriveCartRequest<T>(
  endpoint: string,
  body?: Record<string, unknown>
): Promise<ThriveCartApiResponse<T>> {
  try {
    const response = await fetch(`${thrivecartConfig.apiBaseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${thrivecartConfig.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ThriveCart API] ${endpoint} failed:`, response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data: data as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ThriveCart API] ${endpoint} error:`, message);
    return { success: false, error: message };
  }
}

/**
 * Ping the ThriveCart API to verify connectivity and credentials.
 */
export async function ping(): Promise<boolean> {
  const result = await thriveCartRequest('ping');
  return result.success;
}

/**
 * Fetch customer data by email, including purchases and subscriptions.
 */
export async function getCustomerByEmail(
  email: string
): Promise<ThriveCartApiResponse<ThriveCartApiCustomer>> {
  return thriveCartRequest<ThriveCartApiCustomer>('customer', { email });
}

/**
 * Fetch all customers for a specific product.
 * Returns paginated results — use `page` parameter for pagination.
 */
export async function getProductCustomers(
  productId: string | number,
  page = 1
): Promise<ThriveCartApiResponse<ThriveCartApiCustomer[]>> {
  return thriveCartRequest<ThriveCartApiCustomer[]>('products/customers', {
    product_id: Number(productId),
    page,
  });
}

/**
 * Sleep helper for rate limiting.
 */
export function rateLimitDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
}
