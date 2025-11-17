#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'fs';

const ARTIFACTS = '/Users/pascallammers/.factory/artifacts/tool-outputs';

// User export
const usersLog = readFileSync(`${ARTIFACTS}/mcp_supabase-pointpilot-chat_execute_sql-toolu_01RDmGkC22P6KmrLueukxFxA-31351002.log`, 'utf-8');
const usersMatch = usersLog.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-[^>]+>/);
if (usersMatch) {
  const users = JSON.parse(usersMatch[1].replace(/\n/g, ''));
  writeFileSync('users-export.json', JSON.stringify(users, null, 2));
  console.log(`✅ Users: ${users.length}`);
}

// Subscriptions export
const subsLog = readFileSync(`${ARTIFACTS}/mcp_supabase-pointpilot-chat_execute_sql-toolu_01E7Va2e2RprNpbHLvJ8xmjY-31370362.log`, 'utf-8');
const subsMatch = subsLog.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-[^>]+>/);
if (subsMatch) {
  const subs = JSON.parse(subsMatch[1].replace(/\n/g, ''));
  writeFileSync('subscriptions-export.json', JSON.stringify(subs, null, 2));
  console.log(`✅ Subscriptions: ${subs.length}`);
}

// Access control export
const accessLog = readFileSync(`${ARTIFACTS}/mcp_supabase-pointpilot-chat_execute_sql-toolu_016JgEjt5kbfZnoZKgN2yYw6-31350085.log`, 'utf-8');
const accessMatch = accessLog.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-[^>]+>/);
if (accessMatch) {
  const access = JSON.parse(accessMatch[1].replace(/\n/g, ''));
  writeFileSync('access-control-export.json', JSON.stringify(access, null, 2));
  console.log(`✅ Access Control: ${access.length}`);
}

console.log('\n✨ All exports saved!');
