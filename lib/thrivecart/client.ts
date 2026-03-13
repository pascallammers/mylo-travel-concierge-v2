import { thrivecartConfig } from './config';
import type { ThriveCartApiCustomer, ThriveCartApiResponse, ThriveCartTransactionsResponse } from './types';

const RATE_LIMIT_DELAY_MS = 1100; // ~55 requests/minute (safe margin under 60/min limit)

/**
 * Make an authenticated POST request to the ThriveCart API.
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

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[ThriveCart API] ${endpoint} failed:`, response.status, responseText);
      return { success: false, error: `HTTP ${response.status}: ${responseText}` };
    }

    let data: T;
    try {
      data = JSON.parse(responseText) as T;
    } catch {
      console.error(`[ThriveCart API] ${endpoint} invalid JSON response:`, responseText.slice(0, 200));
      return { success: false, error: `Invalid JSON response from ThriveCart API` };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ThriveCart API] ${endpoint} error:`, message);
    return { success: false, error: message };
  }
}

/**
 * Make an authenticated GET request to the ThriveCart API.
 */
async function thriveCartGetRequest<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<ThriveCartApiResponse<T>> {
  try {
    const url = new URL(`${thrivecartConfig.apiBaseUrl}/${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${thrivecartConfig.apiKey}`,
        'X-TC-Mode': 'live',
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[ThriveCart API] GET ${endpoint} failed:`, response.status, responseText);
      return { success: false, error: `HTTP ${response.status}: ${responseText}` };
    }

    let data: T;
    try {
      data = JSON.parse(responseText) as T;
    } catch {
      console.error(`[ThriveCart API] GET ${endpoint} invalid JSON response:`, responseText.slice(0, 200));
      return { success: false, error: `Invalid JSON response from ThriveCart API` };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ThriveCart API] GET ${endpoint} error:`, message);
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
 * Search transactions from ThriveCart API with pagination.
 * @param page - Page number (1-based)
 * @param perPage - Results per page (max 100)
 * @param transactionType - Filter: 'any', 'charge', 'rebill', 'refund', 'cancel'
 */
export async function searchTransactions(
  page = 1,
  perPage = 100,
  transactionType = 'any'
): Promise<ThriveCartApiResponse<ThriveCartTransactionsResponse>> {
  return thriveCartGetRequest<ThriveCartTransactionsResponse>('transactions', {
    page: String(page),
    perPage: String(perPage),
    transactionType,
  });
}

/**
 * Sleep helper for rate limiting.
 */
export function rateLimitDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
}
