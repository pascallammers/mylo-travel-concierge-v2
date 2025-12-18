import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

interface CSVRow {
  email: string;
  order_date: string;
  full_name: string;
  first_name: string;
  last_name: string;
  subscription_id: string;
}

interface DBUser {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  subscription_id: string | null;
  currentPeriodEnd: string | null;
}

interface SyncResult {
  newUsers: Array<{ email: string; name: string; endDate: string }>;
  updatedUsers: Array<{ email: string; oldEndDate: string; newEndDate: string }>;
  skippedInactive: Array<{ email: string; reason: string }>;
  skippedAlreadyLater: Array<{ email: string; currentEnd: string; csvEnd: string }>;
  notInCSV: Array<{ email: string }>;
}

function parseCSV(filePath: string): CSVRow[] {
  const content = readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records;
}

function addOneMonth(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setMonth(date.getMonth() + 1);
  return date;
}

function formatDateISO(date: Date): string {
  return date.toISOString();
}

export function analyzeSync(csvRows: CSVRow[], dbUsers: DBUser[]): SyncResult {
  const result: SyncResult = {
    newUsers: [],
    updatedUsers: [],
    skippedInactive: [],
    skippedAlreadyLater: [],
    notInCSV: [],
  };

  // Create email lookup map (case-insensitive)
  const dbUserMap = new Map<string, DBUser>();
  for (const user of dbUsers) {
    dbUserMap.set(user.email.toLowerCase(), user);
  }

  // Track which DB users are in CSV
  const csvEmails = new Set<string>();

  // Process each CSV row
  for (const row of csvRows) {
    const email = row.email?.toLowerCase().trim();
    if (!email) continue;

    csvEmails.add(email);
    
    const orderDate = row.order_date;
    if (!orderDate || !/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
      console.warn(`Invalid order_date for ${email}: ${orderDate}`);
      continue;
    }

    const endDate = addOneMonth(orderDate);
    const endDateISO = formatDateISO(endDate);

    const dbUser = dbUserMap.get(email);

    if (!dbUser) {
      // New user - needs to be created
      const name = row.full_name?.trim() || `${row.first_name || ''} ${row.last_name || ''}`.trim() || email;
      result.newUsers.push({
        email: row.email.trim(),
        name,
        endDate: endDateISO,
      });
    } else if (!dbUser.is_active) {
      // User exists but is inactive - skip
      result.skippedInactive.push({
        email,
        reason: 'User is_active = false (cancelled)',
      });
    } else {
      // User exists and is active - check if we need to update
      const currentEndDate = dbUser.currentPeriodEnd ? new Date(dbUser.currentPeriodEnd) : null;
      
      if (!currentEndDate || endDate > currentEndDate) {
        result.updatedUsers.push({
          email,
          oldEndDate: dbUser.currentPeriodEnd || 'null',
          newEndDate: endDateISO,
        });
      } else {
        result.skippedAlreadyLater.push({
          email,
          currentEnd: dbUser.currentPeriodEnd!,
          csvEnd: endDateISO,
        });
      }
    }
  }

  return result;
}

// Generate SQL statements for the sync
export function generateSQL(result: SyncResult): {
  userInserts: string[];
  subscriptionInserts: string[];
  subscriptionUpdates: string[];
} {
  const userInserts: string[] = [];
  const subscriptionInserts: string[] = [];
  const subscriptionUpdates: string[] = [];

  // Generate INSERT statements for new users
  for (const user of result.newUsers) {
    const id = crypto.randomUUID();
    const subscriptionId = crypto.randomUUID();
    const now = new Date().toISOString();

    userInserts.push(`
INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at, role, is_active, activation_status)
VALUES ('${id}', '${user.name.replace(/'/g, "''")}', '${user.email.replace(/'/g, "''")}', false, '${now}', '${now}', 'user', true, 'pending_activation')
ON CONFLICT (email) DO NOTHING;
    `.trim());

    subscriptionInserts.push(`
INSERT INTO subscription (id, "createdAt", amount, currency, "recurringInterval", status, "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd", "startedAt", "customerId", "productId", "checkoutId", "userId")
SELECT '${subscriptionId}', '${now}', 4700, 'EUR', 'month', 'active', '${now}', '${user.endDate}', false, '${now}', '${id}', 'thrivecart_mylo', 'csv_import_${Date.now()}', u.id
FROM "user" u WHERE LOWER(u.email) = LOWER('${user.email.replace(/'/g, "''")}')
ON CONFLICT DO NOTHING;
    `.trim());
  }

  // Generate UPDATE statements for existing users
  for (const user of result.updatedUsers) {
    subscriptionUpdates.push(`
UPDATE subscription s
SET "currentPeriodEnd" = '${user.newEndDate}'
FROM "user" u
WHERE s."userId" = u.id AND LOWER(u.email) = LOWER('${user.email.replace(/'/g, "''")}');
    `.trim());
  }

  return { userInserts, subscriptionInserts, subscriptionUpdates };
}

// Main execution
async function main() {
  const csvPath = process.argv[2] || './docs/purchases-ThriveCart Customer Export 2025-12-18 16_30_11.csv';
  const dbUsersPath = process.argv[3] || './db-users.json';
  
  console.log('📊 ThriveCart CSV Sync Tool');
  console.log('========================\n');
  
  // Parse CSV
  console.log(`📁 Loading CSV from: ${csvPath}`);
  const csvRows = parseCSV(csvPath);
  console.log(`   Found ${csvRows.length} rows in CSV\n`);

  // Load DB users (would need to be provided as JSON export)
  console.log(`📁 Loading DB users from: ${dbUsersPath}`);
  let dbUsers: DBUser[] = [];
  try {
    dbUsers = JSON.parse(readFileSync(dbUsersPath, 'utf-8'));
    console.log(`   Found ${dbUsers.length} users in DB\n`);
  } catch {
    console.log('   ⚠️  No DB users file found - will treat all CSV users as new\n');
  }

  // Analyze
  console.log('🔍 Analyzing sync requirements...\n');
  const result = analyzeSync(csvRows, dbUsers);

  // Print summary
  console.log('📋 SYNC SUMMARY');
  console.log('===============');
  console.log(`✅ New users to create: ${result.newUsers.length}`);
  console.log(`🔄 Users to update (extend subscription): ${result.updatedUsers.length}`);
  console.log(`⏭️  Skipped (inactive/cancelled): ${result.skippedInactive.length}`);
  console.log(`⏭️  Skipped (already has later end date): ${result.skippedAlreadyLater.length}`);
  console.log('');

  // Show details
  if (result.newUsers.length > 0) {
    console.log('\n📝 NEW USERS:');
    result.newUsers.slice(0, 10).forEach(u => {
      console.log(`   - ${u.email} (${u.name}) -> End: ${u.endDate.split('T')[0]}`);
    });
    if (result.newUsers.length > 10) {
      console.log(`   ... and ${result.newUsers.length - 10} more`);
    }
  }

  if (result.updatedUsers.length > 0) {
    console.log('\n🔄 USERS TO UPDATE:');
    result.updatedUsers.slice(0, 10).forEach(u => {
      console.log(`   - ${u.email}: ${u.oldEndDate.split('T')[0]} -> ${u.newEndDate.split('T')[0]}`);
    });
    if (result.updatedUsers.length > 10) {
      console.log(`   ... and ${result.updatedUsers.length - 10} more`);
    }
  }

  if (result.skippedInactive.length > 0) {
    console.log('\n⏭️  SKIPPED (INACTIVE):');
    result.skippedInactive.slice(0, 5).forEach(u => {
      console.log(`   - ${u.email}: ${u.reason}`);
    });
    if (result.skippedInactive.length > 5) {
      console.log(`   ... and ${result.skippedInactive.length - 5} more`);
    }
  }

  // Generate SQL
  if (process.argv.includes('--generate-sql')) {
    const sql = generateSQL(result);
    console.log('\n\n📄 GENERATED SQL STATEMENTS:');
    console.log('============================\n');
    
    console.log('-- USER INSERTS:');
    sql.userInserts.forEach(s => console.log(s));
    
    console.log('\n-- SUBSCRIPTION INSERTS:');
    sql.subscriptionInserts.forEach(s => console.log(s));
    
    console.log('\n-- SUBSCRIPTION UPDATES:');
    sql.subscriptionUpdates.forEach(s => console.log(s));
  }
}

main().catch(console.error);
