/**
 * TypeScript types for ThriveCart webhook payloads via Zapier
 * 
 * These types define the expected request body structure for subscription
 * lifecycle webhooks (rebill, failed, cancel) sent from Zapier.
 */

/**
 * Base webhook request with common fields
 */
export interface BaseWebhookRequest {
  /** Customer email address - used to find the user */
  email: string;
  /** ThriveCart order ID for tracking/idempotency */
  orderId: string;
  /** Webhook secret for authentication */
  webhookSecret: string;
}

/**
 * Rebill (successful recurring payment) webhook request
 */
export interface RebillWebhookRequest extends BaseWebhookRequest {
  /** Payment amount in cents (e.g., 4900 = €49.00) */
  amount?: number;
  /** Currency code (e.g., "EUR", "USD") */
  currency?: string;
  /** Product name from ThriveCart */
  productName?: string;
  /** ThriveCart customer ID */
  customerId?: string;
}

/**
 * Failed payment webhook request
 */
export interface FailedPaymentWebhookRequest extends BaseWebhookRequest {
  /** Timestamp when the payment failed */
  failedAt?: string;
  /** Reason for failure (if provided by ThriveCart) */
  failureReason?: string;
}

/**
 * Subscription cancellation webhook request
 */
export interface CancelWebhookRequest extends BaseWebhookRequest {
  /** Timestamp when the subscription was cancelled */
  cancelledAt?: string;
  /** Cancellation reason (if provided) */
  cancellationReason?: string;
}

/**
 * Standard webhook response
 */
export interface WebhookResponse {
  success: boolean;
  message: string;
  userId?: string;
  subscriptionId?: string;
  error?: string;
}

/**
 * Subscription status values
 */
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired' | 'trialing';

/**
 * User activation status values
 */
export type UserActivationStatus = 'active' | 'inactive' | 'grace_period' | 'suspended';
