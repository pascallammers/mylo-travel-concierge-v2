/**
 * User Migration Script: Supabase → Neon (Better Auth)
 * 
 * This script imports users from Supabase export to Neon database with Better Auth accounts.
 * 
 * Usage:
 * 1. Export users from Supabase using 01-export-users.sql
 * 2. Save JSON as users-export.json in this directory
 * 3. Run: npx tsx tasks/backend/14-11-2025/user-migration/import-users.ts
 */

import { db } from '@/lib/db';
import { user, account, subscription, userAccessControl } from '@/lib/db/schema';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// Generate ID compatible with Better Auth
const generateId = () => randomUUID();

// Types
interface SupabaseUser {
  supabase_user_id: string;
  email: string;
  name: string;
  email_verified: boolean;
  image?: string;
  created_at: string;
  updated_at: string;
  role: 'user' | 'admin';
  last_active_at?: string;
  raw_user_meta_data: any;
  is_active: boolean;
  activation_status: 'active' | 'inactive' | 'grace_period' | 'suspended';
}

interface SupabaseSubscription {
  id: string;
  user_id: string;
  status: string;
  plan_type?: string;
  plan_name?: string;
  thrivecard_customer_id?: string;
  thrivecard_subscription_id?: string;
  start_date: string;
  end_date?: string;
  cancelled_at?: string;
  trial_end_date?: string;
  is_trial?: boolean;
  auto_renew?: boolean;
  next_payment_date?: string;
  last_payment_date?: string;
  payment_method?: string;
  grace_period_end?: string;
  access_level?: string;
  features?: any;
  startedAt: string;
  endsAt?: string;
  canceledAt?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface SupabaseAccessControl {
  id: string;
  user_id: string;
  subscription_id?: string;
  has_access: boolean;
  access_level?: string;
  grace_period_end?: string;
  features?: any;
  last_access_check?: string;
  access_granted_at?: string;
  access_revoked_at?: string;
  status_flag: number;
  created_at: string;
  updated_at: string;
}

// User ID mapping: Supabase UUID → Neon UUID
const userIdMap = new Map<string, string>();

/**
 * Extract JSON data from MCP artifact log files
 */
function extractJSONFromArtifact(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Find untrusted-data tags
  const startTag = '<untrusted-data-';
  const endTag = '</untrusted-data-';
  
  const startIndex = content.indexOf(startTag);
  if (startIndex === -1) {
    throw new Error(`No untrusted-data tag found in ${filePath}`);
  }
  
  const openTagEnd = content.indexOf('>', startIndex);
  const jsonStart = openTagEnd + 1;
  
  const endIndex = content.indexOf(endTag, jsonStart);
  if (endIndex === -1) {
    throw new Error(`No closing tag found in ${filePath}`);
  }
  
  let jsonStr = content.substring(jsonStart, endIndex).trim();
  
  // Find the JSON array start
  const arrayStart = jsonStr.indexOf('[');
  if (arrayStart > 0) {
    jsonStr = jsonStr.substring(arrayStart);
  }
  
  return JSON.parse(jsonStr);
}

async function importUsers() {
  console.log('🚀 Starting user migration from Supabase to Neon...\n');

  // Load from artifact logs
  const artifactsDir = '/Users/pascallammers/.factory/artifacts/tool-outputs';
  const usersLog = path.join(artifactsDir, 'mcp_supabase-pointpilot-chat_execute_sql-toolu_01RDmGkC22P6KmrLueukxFxA-31351002.log');
  const subscriptionsLog = path.join(artifactsDir, 'mcp_supabase-pointpilot-chat_execute_sql-toolu_01E7Va2e2RprNpbHLvJ8xmjY-31370362.log');
  const accessControlLog = path.join(artifactsDir, 'mcp_supabase-pointpilot-chat_execute_sql-toolu_016JgEjt5kbfZnoZKgN2yYw6-31350085.log');

  console.log('📦 Loading data from artifact logs...');
  
  const supabaseUsers: any[] = extractJSONFromArtifact(usersLog);
  const supabaseSubscriptions: any[] = extractJSONFromArtifact(subscriptionsLog);
  const supabaseAccessControls: any[] = extractJSONFromArtifact(accessControlLog);

  console.log(`📊 Found ${supabaseUsers.length} users to import`);
  console.log(`📊 Found ${supabaseSubscriptions.length} subscriptions to import`);
  console.log(`📊 Found ${supabaseAccessControls.length} access control records to import\n`);

  // Step 1: Import Users + Better Auth Accounts
  console.log('👥 Importing users and creating Better Auth accounts...');
  let userCount = 0;
  let accountCount = 0;

  for (const supabaseUser of supabaseUsers) {
    const newUserId = generateId(); // Generate new UUID for Neon
    
    // Extract name from raw_user_meta_data
    const fullName = supabaseUser.raw_user_meta_data?.full_name || supabaseUser.email.split('@')[0];

    try {
      // Insert user
      await db.insert(user).values({
        id: newUserId,
        name: fullName,
        email: supabaseUser.email,
        emailVerified: supabaseUser.raw_user_meta_data?.email_verified || false,
        image: null,
        createdAt: new Date(supabaseUser.created_at),
        updatedAt: new Date(supabaseUser.updated_at),
        role: 'user', // Default role
        isActive: supabaseUser.is_active,
        activationStatus: supabaseUser.activation_status,
        lastActiveAt: supabaseUser.last_active_at ? new Date(supabaseUser.last_active_at) : null,
        supabaseUserId: supabaseUser.id, // Use 'id' not 'supabase_user_id'
        rawUserMetaData: supabaseUser.raw_user_meta_data,
      });
      userCount++;

      // Create Better Auth account (CRITICAL!)
      await db.insert(account).values({
        id: generateId(),
        accountId: supabaseUser.email, // Email as account_id
        providerId: 'credential', // Better Auth email/password provider
        userId: newUserId,
        password: null, // ⚠️ No password - user must reset
        createdAt: new Date(supabaseUser.created_at),
        updatedAt: new Date(supabaseUser.updated_at),
      });
      accountCount++;

      // Store mapping (use 'id' from Supabase)
      userIdMap.set(supabaseUser.id, newUserId);

      if (userCount % 50 === 0) {
        console.log(`   ✅ Imported ${userCount} users...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to import user ${supabaseUser.email}:`, error);
    }
  }

  console.log(`✅ Successfully imported ${userCount} users`);
  console.log(`✅ Successfully created ${accountCount} Better Auth accounts\n`);

  // Step 2: Import Subscriptions
  console.log('💳 Importing subscriptions...');
  let subscriptionCount = 0;

  for (const sub of supabaseSubscriptions) {
    const neonUserId = userIdMap.get(sub.userid); // lowercase 'userid'

    if (!neonUserId) {
      console.warn(`   ⚠️ User ${sub.userid} not found, skipping subscription ${sub.id}`);
      continue;
    }

    try {
      await db.insert(subscription).values({
        id: sub.id,
        userId: neonUserId,
        createdAt: new Date(sub.created_at),
        modifiedAt: new Date(sub.updated_at),

        // ThriveCard fields
        thrivecardCustomerId: sub.thrivecard_customer_id || null,
        thrivecardSubscriptionId: sub.thrivecard_subscription_id || null,
        planType: sub.plan_type || null,
        planName: sub.plan_name || null,

        // Subscription details
        status: sub.status,
        amount: 0, // ⚠️ Unknown - needs ThriveCard data
        currency: 'EUR', // ⚠️ Assumption
        recurringInterval: 'month', // ⚠️ Assumption

        // Timestamps (lowercase fields from Supabase)
        startedAt: new Date(sub.currentperiodstart),
        endsAt: sub.currentperiodend ? new Date(sub.currentperiodend) : null,
        canceledAt: null, // Not in export
        currentPeriodStart: new Date(sub.currentperiodstart),
        currentPeriodEnd: new Date(sub.currentperiodend),
        cancelAtPeriodEnd: sub.cancelatperiodend,

        // Access & Trial
        gracePeriodEnd: sub.grace_period_end ? new Date(sub.grace_period_end) : null,
        accessLevel: sub.access_level || 'basic',
        features: sub.features || {},
        isTrial: sub.is_trial || false,
        trialEndDate: sub.trial_end_date ? new Date(sub.trial_end_date) : null,
        autoRenew: sub.auto_renew ?? true,

        // Payment info
        lastPaymentDate: sub.last_payment_date ? new Date(sub.last_payment_date) : null,
        nextPaymentDate: sub.next_payment_date ? new Date(sub.next_payment_date) : null,
        paymentMethod: sub.payment_method || null,

        // Required fields (placeholders)
        customerId: sub.thrivecard_customer_id || generateId(),
        productId: 'legacy-thrivecard',
        checkoutId: generateId(),
      });
      subscriptionCount++;

      if (subscriptionCount % 50 === 0) {
        console.log(`   ✅ Imported ${subscriptionCount} subscriptions...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to import subscription ${sub.id}:`, error);
    }
  }

  console.log(`✅ Successfully imported ${subscriptionCount} subscriptions\n`);

  // Step 3: Import Access Control
  console.log('🔐 Importing access control records...');
  let accessControlCount = 0;

  for (const access of supabaseAccessControls) {
    const neonUserId = userIdMap.get(access.user_id);

    if (!neonUserId) {
      console.warn(`   ⚠️ User ${access.user_id} not found, skipping access control ${access.id}`);
      continue;
    }

    try {
      await db.insert(userAccessControl).values({
        id: access.id,
        userId: neonUserId,
        subscriptionId: access.subscription_id || null,
        hasAccess: access.has_access,
        accessLevel: access.access_level || 'basic',
        gracePeriodEnd: access.grace_period_end ? new Date(access.grace_period_end) : null,
        features: access.features || {},
        lastAccessCheck: access.last_access_check ? new Date(access.last_access_check) : new Date(),
        accessGrantedAt: access.access_granted_at ? new Date(access.access_granted_at) : null,
        accessRevokedAt: access.access_revoked_at ? new Date(access.access_revoked_at) : null,
        statusFlag: access.status_flag || 1,
        createdAt: new Date(access.created_at),
        updatedAt: new Date(access.updated_at),
      });
      accessControlCount++;

      if (accessControlCount % 50 === 0) {
        console.log(`   ✅ Imported ${accessControlCount} access control records...`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to import access control ${access.id}:`, error);
    }
  }

  console.log(`✅ Successfully imported ${accessControlCount} access control records\n`);

  // Summary
  console.log('📊 Migration Summary:');
  console.log(`   Users: ${userCount} imported`);
  console.log(`   Better Auth Accounts: ${accountCount} created`);
  console.log(`   Subscriptions: ${subscriptionCount} imported`);
  console.log(`   Access Control: ${accessControlCount} imported`);
  console.log(`\n✅ Migration completed successfully!`);
  console.log(`\n⚠️ IMPORTANT: All users need to reset their passwords!`);
}

// Run migration
importUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
