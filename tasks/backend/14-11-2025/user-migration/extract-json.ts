#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'fs';

function extractJSON(filePath: string): any[] {
  const content = readFileSync(filePath, 'utf-8');
  
  // Find the untrusted-data tags
  const startTag = '<untrusted-data-';
  const endTag = '</untrusted-data-';
  
  const startIndex = content.indexOf(startTag);
  if (startIndex === -1) {
    throw new Error(`No untrusted-data tag found in ${filePath}`);
  }
  
  // Find the end of the opening tag
  const openTagEnd = content.indexOf('>', startIndex);
  let jsonStart = openTagEnd + 1;
  
  // Find the closing tag
  const endIndex = content.indexOf(endTag, jsonStart);
  if (endIndex === -1) {
    throw new Error(`No closing tag found in ${filePath}`);
  }
  
  // Extract JSON string
  let jsonStr = content.substring(jsonStart, endIndex).trim();
  
  // The JSON might have some text before it, find the first [
  const jsonArrayStart = jsonStr.indexOf('[');
  if (jsonArrayStart > 0) {
    jsonStr = jsonStr.substring(jsonArrayStart);
  }
  
  // Parse JSON
  return JSON.parse(jsonStr);
}

const ARTIFACTS = '/Users/pascallammers/.factory/artifacts/tool-outputs';

try {
  console.log('📦 Extracting exports from artifacts...\n');
  
  // Users
  const users = extractJSON(`${ARTIFACTS}/mcp_supabase-pointpilot-chat_execute_sql-toolu_01RDmGkC22P6KmrLueukxFxA-31351002.log`);
  writeFileSync('users-export.json', JSON.stringify(users, null, 2));
  console.log(`✅ Users: ${users.length} records`);
  
  // Subscriptions  
  const subs = extractJSON(`${ARTIFACTS}/mcp_supabase-pointpilot-chat_execute_sql-toolu_01E7Va2e2RprNpbHLvJ8xmjY-31370362.log`);
  writeFileSync('subscriptions-export.json', JSON.stringify(subs, null, 2));
  console.log(`✅ Subscriptions: ${subs.length} records`);
  
  // Access Control
  const access = extractJSON(`${ARTIFACTS}/mcp_supabase-pointpilot-chat_execute_sql-toolu_016JgEjt5kbfZnoZKgN2yYw6-31350085.log`);
  writeFileSync('access-control-export.json', JSON.stringify(access, null, 2));
  console.log(`✅ Access Control: ${access.length} records`);
  
  console.log('\n✨ All exports saved successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Users: ${users.length}`);
  console.log(`   Subscriptions: ${subs.length}`);
  console.log(`   Access Control: ${access.length}`);
  console.log('\n✅ Ready for Phase 2: Import to Neon');
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
