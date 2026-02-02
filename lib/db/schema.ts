import { pgTable, text, timestamp, boolean, json, varchar, integer, uuid, real } from 'drizzle-orm/pg-core';
import { generateId } from 'ai';
import { InferSelectModel } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  // Migration fields from Supabase
  isActive: boolean('is_active').default(true),
  activationStatus: text('activation_status', { 
    enum: ['active', 'inactive', 'grace_period', 'suspended'] 
  }).default('active'),
  deactivatedAt: timestamp('deactivated_at'),
  lastActiveAt: timestamp('last_active_at'),
  supabaseUserId: uuid('supabase_user_id'), // Mapping to Supabase auth.users.id
  rawUserMetaData: json('raw_user_meta_data').default({}), // Preserve Supabase metadata
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const chat = pgTable('chat', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => uuidv4()),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  title: text('title').notNull().default('New Chat'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export const message = pgTable('message', {
  id: text('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId()),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // user, assistant, or tool
  parts: json('parts').notNull(), // Store parts as JSON in the database
  attachments: json('attachments').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  totalTokens: integer('total_tokens'),
  completionTime: real('completion_time'),
});

export const stream = pgTable('stream', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

// Subscription table for Polar webhook data (extended for ThriveCard migration)
export const subscription = pgTable('subscription', {
  id: text('id').primaryKey(),
  createdAt: timestamp('createdAt').notNull(),
  modifiedAt: timestamp('modifiedAt'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  recurringInterval: text('recurringInterval').notNull(),
  status: text('status').notNull(),
  currentPeriodStart: timestamp('currentPeriodStart').notNull(),
  currentPeriodEnd: timestamp('currentPeriodEnd').notNull(),
  cancelAtPeriodEnd: boolean('cancelAtPeriodEnd').notNull().default(false),
  canceledAt: timestamp('canceledAt'),
  startedAt: timestamp('startedAt').notNull(),
  endsAt: timestamp('endsAt'),
  endedAt: timestamp('endedAt'),
  customerId: text('customerId').notNull(),
  productId: text('productId').notNull(),
  discountId: text('discountId'),
  checkoutId: text('checkoutId').notNull(),
  customerCancellationReason: text('customerCancellationReason'),
  customerCancellationComment: text('customerCancellationComment'),
  metadata: text('metadata'), // JSON string
  customFieldData: text('customFieldData'), // JSON string
  userId: text('userId').references(() => user.id),
  // ThriveCard migration fields
  thrivecardCustomerId: text('thrivecard_customer_id'),
  thrivecardSubscriptionId: text('thrivecard_subscription_id'),
  planType: text('plan_type'), // e.g. 'starter', 'premium', 'pro'
  planName: text('plan_name'),
  // Access Control & Grace Period
  gracePeriodEnd: timestamp('grace_period_end'),
  accessLevel: text('access_level').default('basic'),
  features: json('features').default({}),
  // Subscription Management
  autoRenew: boolean('auto_renew').default(true),
  isTrial: boolean('is_trial').default(false),
  trialEndDate: timestamp('trial_end_date'),
  lastPaymentDate: timestamp('last_payment_date'),
  nextPaymentDate: timestamp('next_payment_date'),
  paymentMethod: text('payment_method'),
});

// Extreme search usage tracking table
export const extremeSearchUsage = pgTable('extreme_search_usage', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  searchCount: integer('search_count').notNull().default(0),
  date: timestamp('date').notNull().defaultNow(),
  resetAt: timestamp('reset_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Message usage tracking table
export const messageUsage = pgTable('message_usage', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  messageCount: integer('message_count').notNull().default(0),
  date: timestamp('date').notNull().defaultNow(),
  resetAt: timestamp('reset_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Custom instructions table
export const customInstructions = pgTable('custom_instructions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Payment table for Dodo Payments webhook data
export const payment = pgTable('payment', {
  id: text('id').primaryKey(), // payment_id from webhook
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at'),
  brandId: text('brand_id'),
  businessId: text('business_id'),
  cardIssuingCountry: text('card_issuing_country'),
  cardLastFour: text('card_last_four'),
  cardNetwork: text('card_network'),
  cardType: text('card_type'),
  currency: text('currency').notNull(),
  digitalProductsDelivered: boolean('digital_products_delivered').default(false),
  discountId: text('discount_id'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  paymentLink: text('payment_link'),
  paymentMethod: text('payment_method'),
  paymentMethodType: text('payment_method_type'),
  settlementAmount: integer('settlement_amount'),
  settlementCurrency: text('settlement_currency'),
  settlementTax: integer('settlement_tax'),
  status: text('status'),
  subscriptionId: text('subscription_id'),
  tax: integer('tax'),
  totalAmount: integer('total_amount').notNull(),
  // JSON fields for complex objects
  billing: json('billing'), // Billing address object
  customer: json('customer'), // Customer data object
  disputes: json('disputes'), // Disputes array
  metadata: json('metadata'), // Metadata object
  productCart: json('product_cart'), // Product cart array
  refunds: json('refunds'), // Refunds array
  // Foreign key to user
  userId: text('user_id').references(() => user.id),
  // ThriveCard migration fields (for Phase 2)
  thrivecardPaymentId: text('thrivecard_payment_id'),
  thrivecardCustomerId: text('thrivecard_customer_id'),
  paymentProvider: text('payment_provider').default('thrivecard'), // 'thrivecard', 'polar', 'dodo'
  webhookSource: text('webhook_source'), // 'zapier', 'direct', etc.
});

// Lookout table for scheduled searches
export const lookout = pgTable('lookout', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  frequency: text('frequency').notNull(), // 'once', 'daily', 'weekly', 'monthly', 'yearly'
  cronSchedule: text('cron_schedule').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  nextRunAt: timestamp('next_run_at').notNull(),
  qstashScheduleId: text('qstash_schedule_id'),
  status: text('status').notNull().default('active'), // 'active', 'paused', 'archived', 'running'
  lastRunAt: timestamp('last_run_at'),
  lastRunChatId: text('last_run_chat_id'),
  // Store all run history as JSON
  runHistory: json('run_history')
    .$type<
      Array<{
        runAt: string; // ISO date string
        chatId: string;
        status: 'success' | 'error' | 'timeout';
        error?: string;
        duration?: number; // milliseconds
        tokensUsed?: number;
        searchesPerformed?: number;
      }>
    >()
    .default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Tool calls tracking table
export const toolCallStatus = ['queued', 'running', 'succeeded', 'failed', 'timeout', 'canceled'] as const;
export type ToolCallStatus = (typeof toolCallStatus)[number];

export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  status: text('status').$type<ToolCallStatus>().default('queued').notNull(),
  request: json('request'),
  response: json('response'),
  error: text('error'),
  dedupeKey: text('dedupe_key').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
});

// Session state management table
export interface SessionStateData {
  last_flight_request?: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate?: string | null;
    cabin: string;
    passengers?: number;
    awardOnly?: boolean;
    loyaltyPrograms?: string[];
  };
  pending_flight_request?: {
    origin?: string;
    destination?: string;
    departDate?: string;
    returnDate?: string | null;
    cabin?: string;
    passengers?: number;
  } | null;
  selected_itineraries?: Array<Record<string, unknown>>;
  preferences?: Record<string, unknown>;
  memory?: Array<{ type: string; content: string; created_at: string }>;
}

export const sessionStates = pgTable('session_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' })
    .unique(),
  state: json('state').$type<SessionStateData>().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Amadeus OAuth token storage
export const amadeusTokens = pgTable('amadeus_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  environment: text('environment', { enum: ['test', 'prod'] }).notNull(),
  accessToken: text('access_token').notNull(),
  tokenType: text('token_type').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User Access Control table for granular access management (migrated from Supabase)
export const userAccessControl = pgTable('user_access_control', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  subscriptionId: text('subscription_id').references(() => subscription.id, { onDelete: 'set null' }),
  hasAccess: boolean('has_access').default(false),
  accessLevel: text('access_level').default('basic'),
  gracePeriodEnd: timestamp('grace_period_end'),
  features: json('features').default({}),
  lastAccessCheck: timestamp('last_access_check').defaultNow(),
  accessGrantedAt: timestamp('access_granted_at'),
  accessRevokedAt: timestamp('access_revoked_at'),
  statusFlag: integer('status_flag').default(1), // smallint equivalent
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// Knowledge Base Documents
// ============================================

/**
 * Status values for Knowledge Base documents.
 * - uploading: File is being uploaded to Gemini
 * - processing: File is being indexed/processed
 * - active: File is ready for queries
 * - failed: Upload or processing failed
 * - archived: Soft deleted / archived
 */
export const kbDocumentStatus = ['uploading', 'processing', 'active', 'failed', 'archived'] as const;
export type KBDocumentStatus = (typeof kbDocumentStatus)[number];

/**
 * Knowledge Base document metadata table.
 * Stores metadata for documents uploaded to Gemini File Search.
 * Actual file content is stored in Gemini's managed storage.
 */
export const kbDocuments = pgTable('kb_documents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),

  // Gemini File Reference (Legacy Files API)
  geminiFileName: text('gemini_file_name').notNull(), // e.g., "files/abc123"
  geminiFileUri: text('gemini_file_uri').notNull(), // Full URI for API calls

  // Gemini File Search Store Reference (New File Search Stores API)
  fileSearchStoreName: text('file_search_store_name'), // e.g., "fileSearchStores/xyz123"
  fileSearchDocumentName: text('file_search_document_name'), // Indexed document name in store
  fileSearchIndexedAt: timestamp('file_search_indexed_at'), // When document was indexed

  // Display metadata
  displayName: text('display_name').notNull(),
  originalFileName: text('original_file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),

  // Status tracking
  status: text('status').$type<KBDocumentStatus>().notNull().default('uploading'),
  statusMessage: text('status_message'),

  // Indexing metadata
  indexedAt: timestamp('indexed_at'),
  chunkCount: integer('chunk_count'),

  // Configuration
  confidenceThreshold: integer('confidence_threshold').default(70), // Per-document threshold (0-100)

  // Audit fields
  uploadedBy: text('uploaded_by').references(() => user.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'), // Soft delete
});

// ============================================
// Password Reset History
// ============================================

/**
 * Trigger types for password reset emails
 * - manual: Admin clicked reset for single user
 * - bulk: Admin triggered bulk reset for all active users
 */
export const passwordResetTriggerType = ['manual', 'bulk'] as const;
export type PasswordResetTriggerType = (typeof passwordResetTriggerType)[number];

/**
 * Status values for password reset emails
 * - sent: Email was sent successfully
 * - failed: Email failed to send
 */
export const passwordResetStatus = ['sent', 'failed'] as const;
export type PasswordResetStatus = (typeof passwordResetStatus)[number];

/**
 * Resend delivery status values
 * - delivered: Email was delivered to recipient
 * - bounced: Email bounced (invalid address, etc.)
 * - complained: Recipient marked as spam
 * - opened: Recipient opened the email
 * - clicked: Recipient clicked a link
 * - pending: Not yet verified with Resend
 */
export const resendDeliveryStatus = ['delivered', 'bounced', 'complained', 'opened', 'clicked', 'pending'] as const;
export type ResendDeliveryStatus = (typeof resendDeliveryStatus)[number];

/**
 * Password reset history table.
 * Tracks all password reset emails sent to users.
 */
export const passwordResetHistory = pgTable('password_reset_history', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
  sentBy: text('sent_by').references(() => user.id),
  triggerType: text('trigger_type').$type<PasswordResetTriggerType>().notNull().default('manual'),
  status: text('status').$type<PasswordResetStatus>().notNull().default('sent'),
  errorMessage: text('error_message'),
  // Resend verification fields
  resendEmailId: text('resend_email_id'),
  resendStatus: text('resend_status').$type<ResendDeliveryStatus>(),
  resendVerifiedAt: timestamp('resend_verified_at'),
});

export type User = InferSelectModel<typeof user>;
export type Session = InferSelectModel<typeof session>;
export type Account = InferSelectModel<typeof account>;
export type Verification = InferSelectModel<typeof verification>;
export type Chat = InferSelectModel<typeof chat>;
export type Message = InferSelectModel<typeof message>;
export type Stream = InferSelectModel<typeof stream>;
export type Subscription = InferSelectModel<typeof subscription>;
export type Payment = InferSelectModel<typeof payment>;
export type ExtremeSearchUsage = InferSelectModel<typeof extremeSearchUsage>;
export type MessageUsage = InferSelectModel<typeof messageUsage>;
export type CustomInstructions = InferSelectModel<typeof customInstructions>;
export type Lookout = InferSelectModel<typeof lookout>;
export type ToolCall = InferSelectModel<typeof toolCalls>;
export type SessionState = InferSelectModel<typeof sessionStates>;
export type AmadeusToken = InferSelectModel<typeof amadeusTokens>;
export type UserAccessControl = InferSelectModel<typeof userAccessControl>;
export type KBDocument = InferSelectModel<typeof kbDocuments>;
export type PasswordResetHistory = InferSelectModel<typeof passwordResetHistory>;

// ============================================
// AwardWallet Integration
// ============================================

/**
 * Connection status for AwardWallet integration
 */
export const awardwalletConnectionStatus = ['connected', 'disconnected', 'error'] as const;
export type AwardWalletConnectionStatus = (typeof awardwalletConnectionStatus)[number];

/**
 * AwardWallet connections table.
 * Stores OAuth connection state for each user's AwardWallet account.
 */
export const awardwalletConnections = pgTable('awardwallet_connections', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
    .unique(),
  awUserId: text('aw_user_id').notNull(),
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
  lastSyncedAt: timestamp('last_synced_at'),
  status: text('status').$type<AwardWalletConnectionStatus>().notNull().default('connected'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type AwardWalletConnection = InferSelectModel<typeof awardwalletConnections>;

/**
 * Balance unit types for loyalty programs
 */
export const loyaltyBalanceUnit = ['miles', 'points', 'nights', 'credits'] as const;
export type LoyaltyBalanceUnit = (typeof loyaltyBalanceUnit)[number];

/**
 * Loyalty accounts table.
 * Stores individual loyalty program balances synced from AwardWallet.
 */
export const loyaltyAccounts = pgTable('loyalty_accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  connectionId: text('connection_id')
    .notNull()
    .references(() => awardwalletConnections.id, { onDelete: 'cascade' }),
  providerCode: text('provider_code').notNull(),
  providerName: text('provider_name').notNull(),
  balance: integer('balance').notNull().default(0),
  balanceUnit: text('balance_unit').$type<LoyaltyBalanceUnit>().notNull().default('points'),
  eliteStatus: text('elite_status'),
  expirationDate: timestamp('expiration_date'),
  accountNumber: text('account_number'),
  logoUrl: text('logo_url'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type LoyaltyAccount = InferSelectModel<typeof loyaltyAccounts>;

// ============================================
// Failed Search Logs for Monitoring
// ============================================

/**
 * Failed Search Logs table.
 * Tracks flight searches that returned no results for pattern analysis.
 * Automatically expires after 30 days.
 */
export const failedSearchLogs = pgTable('failed_search_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => generateId()),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),

  // Query data
  queryText: text('query_text').notNull(),
  extractedOrigin: text('extracted_origin'),
  extractedDestination: text('extracted_destination'),
  departDate: text('depart_date'),
  returnDate: text('return_date'),
  cabin: text('cabin'),

  // Context
  resultCount: integer('result_count').notNull().default(0),
  errorType: text('error_type'), // 'no_results', 'provider_unavailable', 'extraction_failed'
  errorMessage: text('error_message'),

  // Metadata
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  expiresAt: timestamp('expires_at')
    .notNull()
    .$defaultFn(() => {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date;
    }),
});

export type FailedSearchLog = InferSelectModel<typeof failedSearchLogs>;
