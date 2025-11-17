/**
 * ULTRA FAST Import: Liest exportierte Daten und importiert direkt
 * Keine externe API-Calls, nur lokale Datei → Neon DB
 */

import { db } from '@/lib/db';
import { user, account } from '@/lib/db/schema';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

// Lese die exportierten User aus dem Artifact-Log
const ARTIFACT_PATH = '/Users/pascallammers/.factory/artifacts/tool-outputs/mcp_supabase-pointpilot-chat_execute_sql-toolu_01S88MKo5DGwjnsD5vRXoGt7-36131729.log';

async function ultraFastImport() {
  console.log('🚀 ULTRA FAST Import: Artifact Log → Neon\n');
  
  // Lese Artifact-Log
  console.log('📦 Reading artifact log...');
  const logContent = readFileSync(ARTIFACT_PATH, 'utf-8');
  
  // Extrahiere JSON zwischen den untrusted-data Tags
  const jsonMatch = logContent.match(/<untrusted-data-[^>]+>\n(\[.*\])\n<\/untrusted-data-/s);
  
  if (!jsonMatch) {
    console.error('❌ Konnte JSON nicht aus Log extrahieren!');
    process.exit(1);
  }
  
  const users = JSON.parse(jsonMatch[1]);
  console.log(`✅ ${users.length} User gefunden\n`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  console.log('📥 Importiere User...');
  
  for (const supaUser of users) {
    try {
      const newUserId = randomUUID();
      const fullName = supaUser.full_name || supaUser.email.split('@')[0];
      const emailVerified = supaUser.raw_user_meta_data?.email_verified || false;
      
      // Activation Status
      const activationStatus = supaUser.last_sign_in_at ? 'active' : 'pending_activation';
      
      // User erstellen
      await db.insert(user).values({
        id: newUserId,
        name: fullName,
        email: supaUser.email,
        emailVerified,
        image: null,
        createdAt: new Date(supaUser.created_at),
        updatedAt: new Date(supaUser.updated_at),
        role: 'user',
        isActive: true,
        activationStatus,
        lastActiveAt: supaUser.last_sign_in_at ? new Date(supaUser.last_sign_in_at) : null,
        supabaseUserId: supaUser.id,
        rawUserMetaData: supaUser.raw_user_meta_data || {},
      });
      
      // Better Auth Account erstellen
      await db.insert(account).values({
        id: randomUUID(),
        accountId: supaUser.email,
        providerId: 'credential',
        userId: newUserId,
        password: null, // ⚠️ Password Reset erforderlich
        createdAt: new Date(supaUser.created_at),
        updatedAt: new Date(supaUser.updated_at),
      });
      
      imported++;
      
      if (imported % 25 === 0) {
        console.log(`   ✅ ${imported} User importiert...`);
      }
    } catch (err: any) {
      if (err.message?.includes('duplicate key')) {
        skipped++;
      } else {
        console.error(`   ❌ Fehler bei ${supaUser.email}:`, err.message);
        errors++;
      }
    }
  }
  
  console.log('\n📊 Import abgeschlossen!');
  console.log(`   ✅ Importiert: ${imported}`);
  console.log(`   ⏭️  Übersprungen (Duplikate): ${skipped}`);
  console.log(`   ❌ Fehler: ${errors}`);
  
  // Final Check
  const totalCount = await db.select().from(user).then(rows => rows.length);
  const migratedCount = await db.select().from(user).where({ supabaseUserId: { $ne: null } }).then(rows => rows.length);
  
  console.log(`\n📈 Neon Database Status:`);
  console.log(`   Total Users: ${totalCount}`);
  console.log(`   Migrated Users: ${migratedCount}`);
  console.log(`\n⚠️  WICHTIG: Alle ${imported} User benötigen Password-Reset!`);
}

ultraFastImport()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Import fehlgeschlagen:', err);
    process.exit(1);
  });
