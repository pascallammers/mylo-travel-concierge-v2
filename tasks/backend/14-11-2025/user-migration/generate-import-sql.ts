#!/usr/bin/env tsx
/**
 * Generate SQL INSERT statements for Neon import
 * Uses exported data from Supabase artifacts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Extract JSON from MCP artifact
function extractJSON(filePath: string): any[] {
  const content = readFileSync(filePath, 'utf-8');
  const startTag = '<untrusted-data-';
  const endTag = '</untrusted-data-';
  
  const startIndex = content.indexOf(startTag);
  const openTagEnd = content.indexOf('>', startIndex);
  const jsonStart = openTagEnd + 1;
  const endIndex = content.indexOf(endTag, jsonStart);
  
  let jsonStr = content.substring(jsonStart, endIndex).trim();
  const arrayStart = jsonStr.indexOf('[');
  if (arrayStart > 0) {
    jsonStr = jsonStr.substring(arrayStart);
  }
  
  return JSON.parse(jsonStr);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function escapeSQL(str: any): string {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'boolean') return str ? 'true' : 'false';
  if (typeof str === 'number') return str.toString();
  if (typeof str === 'object') return `'${JSON.stringify(str).replace(/'/g, "''")}'`;
  return `'${str.toString().replace(/'/g, "''")}'`;
}

const ARTIFACTS = '/Users/pascallammers/.factory/artifacts/tool-outputs';

const usersData = extractJSON(join(ARTIFACTS, 'mcp_supabase-pointpilot-chat_execute_sql-toolu_01RDmGkC22P6KmrLueukxFxA-31351002.log'));
const subsData = extractJSON(join(ARTIFACTS, 'mcp_supabase-pointpilot-chat_execute_sql-toolu_01E7Va2e2RprNpbHLvJ8xmjY-31370362.log'));
const accessData = extractJSON(join(ARTIFACTS, 'mcp_supabase-pointpilot-chat_execute_sql-toolu_016JgEjt5kbfZnoZKgN2yYw6-31350085.log'));

console.log(`📊 Loaded ${usersData.length} users, ${subsData.length} subscriptions, ${accessData.length} access records\n`);

// Create mapping: Supabase ID -> Neon ID
const userIdMap = new Map<string, string>();

// Generate User + Account SQL
let userSQL = `-- Import Users + Better Auth Accounts\n-- Total: ${usersData.length} users\n\n`;
let accountSQL = '';
let batchCount = 0;

for (const user of usersData) {
  const newUserId = generateUUID();
  const fullName = user.raw_user_meta_data?.full_name || user.email.split('@')[0];
  const emailVerified = user.raw_user_meta_data?.email_verified || false;
  
  userIdMap.set(user.id, newUserId);
  
  userSQL += `INSERT INTO "user" (
    id, name, email, "emailVerified", image, "createdAt", "updatedAt",
    role, "isActive", "activationStatus", "lastActiveAt", "supabaseUserId", "rawUserMetaData"
  ) VALUES (
    ${escapeSQL(newUserId)},
    ${escapeSQL(fullName)},
    ${escapeSQL(user.email)},
    ${emailVerified},
    NULL,
    ${escapeSQL(user.created_at)},
    ${escapeSQL(user.updated_at)},
    'user',
    ${user.is_active},
    ${escapeSQL(user.activation_status)},
    ${user.last_active_at ? escapeSQL(user.last_active_at) : 'NULL'},
    ${escapeSQL(user.id)},
    ${escapeSQL(user.raw_user_meta_data)}
  );\n\n`;
  
  // Better Auth Account
  const accountId = generateUUID();
  accountSQL += `INSERT INTO "account" (
    id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
  ) VALUES (
    ${escapeSQL(accountId)},
    ${escapeSQL(user.email)},
    'credential',
    ${escapeSQL(newUserId)},
    NULL,
    ${escapeSQL(user.created_at)},
    ${escapeSQL(user.updated_at)}
  );\n\n`;
  
  batchCount++;
  
  // Split into batches of 50
  if (batchCount % 50 === 0) {
    writeFileSync(
      join(__dirname, `import-users-batch-${Math.floor(batchCount / 50)}.sql`),
      userSQL + accountSQL
    );
    console.log(`✅ Generated batch ${Math.floor(batchCount / 50)} (${batchCount} users)`);
    userSQL = `-- Users batch ${Math.floor(batchCount / 50) + 1}\n\n`;
    accountSQL = '';
  }
}

// Write remaining
if (batchCount % 50 !== 0) {
  writeFileSync(
    join(__dirname, `import-users-batch-${Math.ceil(batchCount / 50)}.sql`),
    userSQL + accountSQL
  );
  console.log(`✅ Generated final batch (${batchCount % 50} users)`);
}

// Save mapping
writeFileSync(
  join(__dirname, 'user-id-mapping.json'),
  JSON.stringify(Object.fromEntries(userIdMap), null, 2)
);

console.log(`\n✅ Generated ${Math.ceil(batchCount / 50)} SQL batch files`);
console.log(`✅ Saved user ID mapping`);
console.log(`\n📝 Next: Import subscriptions and access control`);
