#!/usr/bin/env tsx

/**
 * Extract JSON data from Supabase export log files
 * 
 * This script reads the artifact log files from the previous Droid session
 * and extracts the JSON data into proper export files for the migration.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ARTIFACTS_DIR = '/Users/pascallammers/.factory/artifacts/tool-outputs';
const OUTPUT_DIR = '/Users/pascallammers/Dev/Client-Work/lovelifepassport/mylo-travel-concierge-v2/tasks/backend/14-11-2025/user-migration';

const LOG_FILES = {
  users: 'mcp_supabase-pointpilot-chat_execute_sql-toolu_01WMmgUzL9oNPYDX5A4CKran-31179763.log',
  subscriptions: 'mcp_supabase-pointpilot-chat_execute_sql-toolu_01NUtHgVNktJwpNi7tbsz6hh-31180462.log',
  accessControl: 'mcp_supabase-pointpilot-chat_execute_sql-toolu_01TAcq9zKpM7VRjsHNHAYc6F-31150630.log'
};

/**
 * Extract JSON data from untrusted-data XML tags
 */
function extractJsonFromLog(logContent: string): any[] {
  // Match the untrusted-data tags (they span multiple lines, JSON is on one line)
  const match = logContent.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-[^>]+>/);
  
  if (!match) {
    throw new Error('Could not find JSON data in log file');
  }
  
  // The JSON might have line breaks in the middle - normalize it
  const jsonString = match[1].replace(/\n/g, '');
  
  return JSON.parse(jsonString);
}

async function main() {
  console.log('🔍 Extracting export data from artifact logs...\n');
  
  try {
    // Extract users
    console.log('📋 Processing users export...');
    const usersLog = readFileSync(join(ARTIFACTS_DIR, LOG_FILES.users), 'utf-8');
    const usersData = extractJsonFromLog(usersLog);
    writeFileSync(
      join(OUTPUT_DIR, 'users-export.json'),
      JSON.stringify(usersData, null, 2)
    );
    console.log(`✅ Exported ${usersData.length} users\n`);
    
    // Extract subscriptions
    console.log('💳 Processing subscriptions export...');
    const subscriptionsLog = readFileSync(join(ARTIFACTS_DIR, LOG_FILES.subscriptions), 'utf-8');
    const subscriptionsData = extractJsonFromLog(subscriptionsLog);
    writeFileSync(
      join(OUTPUT_DIR, 'subscriptions-export.json'),
      JSON.stringify(subscriptionsData, null, 2)
    );
    console.log(`✅ Exported ${subscriptionsData.length} subscriptions\n`);
    
    // Extract access control
    console.log('🔐 Processing access control export...');
    const accessControlLog = readFileSync(join(ARTIFACTS_DIR, LOG_FILES.accessControl), 'utf-8');
    const accessControlData = extractJsonFromLog(accessControlLog);
    writeFileSync(
      join(OUTPUT_DIR, 'access-control-export.json'),
      JSON.stringify(accessControlData, null, 2)
    );
    console.log(`✅ Exported ${accessControlData.length} access control records\n`);
    
    console.log('✨ All export data extracted successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${usersData.length}`);
    console.log(`   Subscriptions: ${subscriptionsData.length}`);
    console.log(`   Access Control: ${accessControlData.length}`);
    console.log('\n✅ Ready for Phase 2: Import to Neon');
    
  } catch (error) {
    console.error('❌ Error extracting data:', error);
    process.exit(1);
  }
}

main();
