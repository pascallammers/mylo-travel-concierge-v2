#!/usr/bin/env node
/**
 * Complete User Migration Script
 * Imports remaining users from Supabase to Neon
 * 
 * Usage: node --env-file=../../../../.env.local complete-migration.js
 */

import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_KEY || !DATABASE_URL) {
  console.error('❌ Missing environment variables!');
  console.error('Required: SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sql = neon(DATABASE_URL);

async function getCurrentCount() {
  const result = await sql`SELECT COUNT(*)::int as count FROM "user"`;
  return result[0].count;
}

async function fetchRemainingUsers(offset = 155) {
  const query = `
    SELECT 
      id,
      email,
      created_at,
      updated_at,
      email_confirmed_at,
      raw_user_meta_data
    FROM auth.users
    ORDER BY created_at
    LIMIT 200 OFFSET ${offset}
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { query });
  
  if (error) throw error;
  return data;
}

async function importUsers(users) {
  let imported = 0;
  
  for (const user of users) {
    const fullName = user.raw_user_meta_data?.full_name || user.email;
    
    // Insert user
    await sql`
      INSERT INTO "user" (
        id, email, email_verified, name, created_at, updated_at, 
        role, is_active, activation_status, last_active_at, 
        supabase_user_id, raw_user_meta_data
      ) VALUES (
        ${user.id},
        ${user.email},
        ${user.email_confirmed_at ? true : false},
        ${fullName},
        ${user.created_at},
        ${user.updated_at},
        'user',
        true,
        'active',
        ${user.updated_at},
        ${user.id},
        ${JSON.stringify(user.raw_user_meta_data || {})}::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;
    
    // Insert Better Auth account
    await sql`
      INSERT INTO account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      )
      SELECT 
        gen_random_uuid(),
        ${user.id},
        'credential',
        ${user.id},
        NULL,
        ${user.created_at},
        ${user.updated_at}
      WHERE NOT EXISTS (
        SELECT 1 FROM account 
        WHERE account_id = ${user.id} AND provider_id = 'credential'
      )
    `;
    
    imported++;
    if (imported % 10 === 0) {
      process.stdout.write(`\r✅ Imported ${imported} users...`);
    }
  }
  
  console.log(`\n✅ Successfully imported ${imported} users!`);
  return imported;
}

async function main() {
  console.log('🚀 Starting final user migration...\n');
  
  // Get current count
  const currentCount = await getCurrentCount();
  console.log(`📊 Current count: ${currentCount}/311 users`);
  console.log(`⏳ Remaining: ${311 - currentCount} users\n`);
  
  if (currentCount >= 311) {
    console.log('✅ All users already imported!');
    return;
  }
  
  // Fetch remaining users from Supabase
  console.log(`📥 Fetching users from Supabase (offset ${currentCount})...`);
  const users = await fetchRemainingUsers(currentCount);
  console.log(`📥 Found ${users.length} users to import\n`);
  
  if (users.length === 0) {
    console.log('✅ No more users to import!');
    return;
  }
  
  // Import to Neon
  console.log('📝 Importing to Neon...');
  await importUsers(users);
  
  // Final count
  const finalCount = await getCurrentCount();
  console.log(`\n🎉 Migration complete!`);
  console.log(`📊 Total users: ${finalCount}/311`);
  console.log(`✅ Progress: ${((finalCount / 311) * 100).toFixed(1)}%\n`);
  
  if (finalCount < 311) {
    console.log(`⚠️  Still ${311 - finalCount} users remaining.`);
    console.log(`   Run this script again to continue.`);
  }
}

main().catch(console.error);
