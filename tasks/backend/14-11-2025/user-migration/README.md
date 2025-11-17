# User Migration: Supabase → Neon (Better Auth + ThriveCard)

## 📋 Overview

This migration transfers 311 users from Supabase to Neon with Better Auth integration while preserving ThriveCard subscription data.

## 🎯 Migration Steps

### Phase 1: Export Data from Supabase

1. **Export Users**
   ```bash
   # Run in Supabase SQL Editor
   cat 01-export-users.sql
   ```
   - Copy SQL and execute in Supabase SQL Editor
   - Download result as `users-export.json`
   - Save to this directory

2. **Export Subscriptions**
   ```bash
   # Run in Supabase SQL Editor
   cat 02-export-subscriptions.sql
   ```
   - Copy SQL and execute in Supabase SQL Editor
   - Download result as `subscriptions-export.json`
   - Save to this directory

3. **Export Access Control**
   ```bash
   # Run in Supabase SQL Editor
   cat 03-export-access-control.sql
   ```
   - Copy SQL and execute in Supabase SQL Editor
   - Download result as `access-control-export.json`
   - Save to this directory

### Phase 2: Import to Neon

4. **Run Import Script**
   ```bash
   cd /Users/pascallammers/Dev/Client-Work/lovelifepassport/mylo-travel-concierge-v2
   npx tsx tasks/backend/14-11-2025/user-migration/import-users.ts
   ```

   The script will:
   - ✅ Import 311 users
   - ✅ Create Better Auth accounts (password = NULL)
   - ✅ Import subscriptions with ThriveCard data
   - ✅ Import access control records

### Phase 3: Validation

5. **Run Validation Queries**
   ```bash
   npx tsx tasks/backend/14-11-2025/user-migration/validate.ts
   ```

   Expected Results:
   - Users: 311
   - Active Users: ~254
   - Accounts: 311
   - Subscriptions: 308
   - Access Control: ~308

## 🔐 Post-Migration Steps

### 1. Send Password Reset Emails

All 311 users need to reset their passwords:

```typescript
// See: send-password-reset-emails.ts
npm run migration:send-emails
```

### 2. Database Triggers (Auto-installed)

The following triggers automatically update user status:

```sql
-- Trigger on subscription changes
CREATE TRIGGER trigger_update_user_active_status_on_subscription...

-- Trigger on access control changes
CREATE TRIGGER trigger_update_user_active_status_on_access...
```

### 3. Test User Login

1. Pick a test user
2. Click "Forgot Password"
3. Set new password
4. Login and verify:
   - User profile loads
   - Subscription status correct
   - Access permissions work

## 📊 Schema Changes Applied

### User Table
- ✅ `is_active` (boolean)
- ✅ `activation_status` (text)
- ✅ `deactivated_at` (timestamp)
- ✅ `last_active_at` (timestamp)
- ✅ `supabase_user_id` (uuid) - mapping
- ✅ `raw_user_meta_data` (json)

### Subscription Table
- ✅ `thrivecard_customer_id` (text)
- ✅ `thrivecard_subscription_id` (text)
- ✅ `plan_type` (text)
- ✅ `plan_name` (text)
- ✅ `grace_period_end` (timestamp)
- ✅ `access_level` (text)
- ✅ `features` (json)
- ✅ `auto_renew` (boolean)
- ✅ `is_trial` (boolean)
- ✅ `trial_end_date` (timestamp)
- ✅ `last_payment_date` (timestamp)
- ✅ `next_payment_date` (timestamp)
- ✅ `payment_method` (text)

### New: user_access_control Table
- ✅ Complete table created with all fields

### Payment Table
- ✅ `thrivecard_payment_id` (text)
- ✅ `thrivecard_customer_id` (text)
- ✅ `payment_provider` (text)
- ✅ `webhook_source` (text)

## ⚠️ Important Notes

1. **Better Auth Accounts**
   - Every user MUST have an account entry
   - `password = NULL` requires password reset
   - `providerId = 'credential'` for email/password

2. **ThriveCard Integration (Phase 2)**
   - All ThriveCard fields preserved
   - Ready for Zapier webhook integration
   - Polar/Dodo code remains (not used)

3. **User Communication**
   - Send clear migration email
   - Explain password reset requirement
   - Provide support contact

## 🚨 Rollback Plan

If migration fails:

```sql
-- Delete imported data
DELETE FROM public.user_access_control WHERE user_id IN (
  SELECT id FROM public.user WHERE supabase_user_id IS NOT NULL
);

DELETE FROM public.subscription WHERE userId IN (
  SELECT id FROM public.user WHERE supabase_user_id IS NOT NULL
);

DELETE FROM public.account WHERE userId IN (
  SELECT id FROM public.user WHERE supabase_user_id IS NOT NULL
);

DELETE FROM public.user WHERE supabase_user_id IS NOT NULL;
```

## 📞 Support

If issues occur:
1. Check `import-users.ts` logs for errors
2. Run validation queries
3. Contact development team
