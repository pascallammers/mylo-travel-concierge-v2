/**
 * Validation Script: Verify User Migration Success
 * 
 * This script runs validation queries to ensure the migration completed successfully.
 * 
 * Usage: npx tsx tasks/backend/14-11-2025/user-migration/validate.ts
 */

import { db } from '@/lib/db';
import { user, account, subscription, userAccessControl } from '@/lib/db/schema';
import { sql, eq, and } from 'drizzle-orm';

async function validateMigration() {
  console.log('🔍 Starting migration validation...\n');

  try {
    // 1. User Count
    const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(user);
    const activeUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(eq(user.isActive, true));
    const migratedUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(sql`supabase_user_id IS NOT NULL`);

    console.log('👥 User Validation:');
    console.log(`   Total users: ${totalUsers[0].count} (Expected: 311+)`);
    console.log(`   Active users: ${activeUsers[0].count} (Expected: ~254)`);
    console.log(`   Migrated from Supabase: ${migratedUsers[0].count} (Expected: 311)`);
    
    const userCheck = totalUsers[0].count >= 311;
    console.log(`   ${userCheck ? '✅' : '❌'} User count validation\n`);

    // 2. Better Auth Account Verification
    const accountsWithPassword = await db
      .select({ count: sql<number>`count(*)` })
      .from(account)
      .where(sql`password IS NOT NULL`);
    const accountsWithoutPassword = await db
      .select({ count: sql<number>`count(*)` })
      .from(account)
      .where(sql`password IS NULL`);
    const usersWithAccounts = await db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .innerJoin(account, eq(account.userId, user.id));

    console.log('🔐 Better Auth Account Validation:');
    console.log(`   Users with accounts: ${usersWithAccounts[0].count} (Expected: 311+)`);
    console.log(`   Accounts with password: ${accountsWithPassword[0].count} (Expected: ~0)`);
    console.log(`   Accounts without password: ${accountsWithoutPassword[0].count} (Expected: 311)`);
    
    const accountCheck = usersWithAccounts[0].count >= 311 && accountsWithoutPassword[0].count >= 311;
    console.log(`   ${accountCheck ? '✅' : '❌'} Account validation\n`);

    // 3. Subscription Status
    const subscriptionStats = await db
      .select({ 
        status: subscription.status, 
        count: sql<number>`count(*)` 
      })
      .from(subscription)
      .groupBy(subscription.status);

    console.log('💳 Subscription Validation:');
    subscriptionStats.forEach(stat => {
      console.log(`   ${stat.status}: ${stat.count}`);
    });
    
    const totalSubscriptions = subscriptionStats.reduce((sum, stat) => sum + Number(stat.count), 0);
    const subscriptionCheck = totalSubscriptions >= 300;
    console.log(`   Total: ${totalSubscriptions} (Expected: ~308)`);
    console.log(`   ${subscriptionCheck ? '✅' : '❌'} Subscription validation\n`);

    // 4. Access Control
    const accessControl = await db
      .select({
        total: sql<number>`count(*)`,
        withAccess: sql<number>`count(*) FILTER (WHERE has_access = true)`,
        inGracePeriod: sql<number>`count(*) FILTER (WHERE grace_period_end > NOW())`,
      })
      .from(userAccessControl);

    console.log('🔓 Access Control Validation:');
    console.log(`   Total records: ${accessControl[0].total} (Expected: ~308)`);
    console.log(`   With access: ${accessControl[0].withAccess} (Expected: ~254)`);
    console.log(`   In grace period: ${accessControl[0].inGracePeriod}`);
    
    const accessCheck = Number(accessControl[0].total) >= 250;
    console.log(`   ${accessCheck ? '✅' : '❌'} Access control validation\n`);

    // 5. ThriveCard Integration
    const thrivecardSubs = await db
      .select({
        total: sql<number>`count(*)`,
        uniqueCustomers: sql<number>`count(DISTINCT thrivecard_customer_id)`,
      })
      .from(subscription)
      .where(sql`thrivecard_customer_id IS NOT NULL`);

    console.log('💰 ThriveCard Integration Validation:');
    console.log(`   Subscriptions with ThriveCard ID: ${thrivecardSubs[0].total}`);
    console.log(`   Unique ThriveCard customers: ${thrivecardSubs[0].uniqueCustomers}`);
    
    const thrivecardCheck = Number(thrivecardSubs[0].total) > 0;
    console.log(`   ${thrivecardCheck ? '✅' : '❌'} ThriveCard data validation\n`);

    // 6. Activation Status Distribution
    const activationStats = await db
      .select({
        status: user.activationStatus,
        count: sql<number>`count(*)`,
      })
      .from(user)
      .groupBy(user.activationStatus);

    console.log('📊 Activation Status Distribution:');
    activationStats.forEach(stat => {
      console.log(`   ${stat.status}: ${stat.count}`);
    });
    console.log();

    // 7. Sample Data Check
    const sampleUser = await db
      .select({
        email: user.email,
        isActive: user.isActive,
        activationStatus: user.activationStatus,
        hasAccount: sql<boolean>`EXISTS(SELECT 1 FROM account WHERE account.user_id = "user".id)`,
        hasSubscription: sql<boolean>`EXISTS(SELECT 1 FROM subscription WHERE subscription."userId" = "user".id)`,
      })
      .from(user)
      .where(sql`supabase_user_id IS NOT NULL`)
      .limit(1);

    if (sampleUser.length > 0) {
      console.log('🔬 Sample User Check:');
      console.log(`   Email: ${sampleUser[0].email}`);
      console.log(`   Active: ${sampleUser[0].isActive ? '✅' : '❌'}`);
      console.log(`   Status: ${sampleUser[0].activationStatus}`);
      console.log(`   Has Account: ${sampleUser[0].hasAccount ? '✅' : '❌'}`);
      console.log(`   Has Subscription: ${sampleUser[0].hasSubscription ? '✅' : '❌'}`);
      console.log();
    }

    // Final Summary
    const allChecks = [userCheck, accountCheck, subscriptionCheck, accessCheck, thrivecardCheck];
    const passedChecks = allChecks.filter(Boolean).length;
    
    console.log('═'.repeat(50));
    console.log(`\n📋 Validation Summary: ${passedChecks}/${allChecks.length} checks passed`);
    
    if (passedChecks === allChecks.length) {
      console.log('\n✅ Migration validation PASSED! All systems ready.');
      console.log('\n⚠️  Next steps:');
      console.log('   1. Send password reset emails to all 311 users');
      console.log('   2. Monitor user logins and support requests');
      console.log('   3. Update documentation with new auth flow');
    } else {
      console.log('\n⚠️  Migration validation INCOMPLETE. Please review failed checks above.');
      console.log('   Run import script again or investigate data discrepancies.');
    }

  } catch (error) {
    console.error('💥 Validation failed with error:', error);
    process.exit(1);
  }
}

// Run validation
validateMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
