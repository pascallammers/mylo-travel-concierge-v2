/**
 * ThriveCart webhook payload types.
 *
 * Standard webhooks send data as multipart/form-data.
 * All price fields are in "hundreds" (cents) — divide by 100 for actual amount.
 * The `amount_str` field provides pre-formatted currency strings.
 */

// --- Webhook Payload Types ---

export interface ThriveCartCustomer {
  name: string;
  firstname: string;
  lastname: string;
  email: string;
  address: {
    line1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface ThriveCartCharge {
  amount: number;       // in hundreds (cents)
  amount_str: string;   // formatted, e.g. "$47.00"
  status: string;
}

export interface ThriveCartOrder {
  date: string;
  total: number;        // in hundreds
  total_str: string;
  tax: number;
  tax_type: string;
  processor: string;    // 'thrivepay', 'paypal_v2', 'stripe', etc.
  payment_method: string;
  charges: ThriveCartCharge[];
  future_charges?: ThriveCartCharge[];
}

export interface ThriveCartPurchase {
  product_id: number;
  product_name: string;
  pricing_option: string;
  type: 'product' | 'bump' | 'upsell' | 'downsell';
  amount: number;       // in hundreds
  amount_str: string;
  subscription?: {
    id: string;         // processor subscription ID
    status: string;     // 'active', 'cancelled', 'paused', etc.
    frequency: string;  // 'month', 'year', etc.
    next_payment_date?: string;
  };
}

export interface ThriveCartWebhookPayload {
  event: ThriveCartEventType;
  event_id?: number;
  mode: 'live' | 'test';
  thrivecart_account: string;
  thrivecart_secret: string;
  base_product: number;
  order_id: number;
  invoice_id: string;
  currency: string;
  customer_id: number;
  customer_identifier?: string;
  customer: ThriveCartCustomer;
  order: ThriveCartOrder;
  purchases: ThriveCartPurchase[];
  purchase_map?: Record<string, unknown>;
}

export type ThriveCartEventType =
  | 'order.success'
  | 'order.refund'
  | 'order.subscription_payment'
  | 'order.subscription_cancelled'
  | 'order.subscription_paused'
  | 'order.subscription_resumed'
  | 'order.rebill_failed'
  | 'cart.abandoned';

// --- API Response Types ---

export interface ThriveCartApiCustomer {
  id: number;
  email: string;
  name: string;
  purchases: ThriveCartApiPurchase[];
}

export interface ThriveCartApiPurchase {
  order_id: number;
  product_id: number;
  product_name: string;
  status: string;
  subscription?: {
    id: string;
    status: 'active' | 'cancelled' | 'paused' | 'completed';
    frequency: string;
    next_payment_date?: string;
    last_payment_date?: string;
    amount: number;
    currency: string;
  };
}

export interface ThriveCartApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Internal Processing Types ---

export type WebhookProcessingResult = {
  success: boolean;
  action: string;
  userId?: string;
  subscriptionId?: string;
  error?: string;
};

export type SyncDiscrepancy = {
  userId: string;
  email: string;
  field: string;
  dbValue: string;
  thriveCartValue: string;
  corrected: boolean;
};

export type SyncResult = {
  totalChecked: number;
  totalCorrected: number;
  totalErrors: number;
  discrepancies: SyncDiscrepancy[];
  errors: Array<{ email: string; error: string }>;
};
