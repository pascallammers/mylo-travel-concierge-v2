/**
 * FAST User Migration: Supabase → Neon (DIREKT)
 * 
 * Importiert ALL 272 verbleibenden User DIREKT aus Supabase
 * Keine Artifact-Logs, keine JSON-Dateien - direkter API-Zugriff
 */

import { createClient } from '@supabase/supabase-js';
import { db } from '@/lib/db';
import { user, account } from '@/lib/db/schema';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

// Load .env.local
config({ path: '.env.local' });

// Supabase Config (pointpilot-chat Projekt)
const SUPABASE_URL = 'https://nmyfqojhpxrcvspkttud.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY nicht in .env.local gesetzt!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function fastImport() {
  console.log('🚀 FAST Import: Supabase → Neon (Direkt)');
  console.log('⏭️  Skipping first 39 users (already imported)\n');

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Hole ALLE User aus Supabase (ab offset 39)
  const BATCH_SIZE = 100;
  let offset = 39;
  let hasMore = true;

  while (hasMore) {
    console.log(`\n📦 Loading batch from offset ${offset}...`);
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Fehler beim Laden von Supabase:', error);
      break;
    }

    if (!users || users.length === 0) {
      console.log('✅ Alle User geladen!');
      hasMore = false;
      break;
    }

    console.log(`   Importiere ${users.length} User...`);

    // Importiere Batch
    for (const supaUser of users) {
      try {
        const newUserId = randomUUID();
        const fullName = supaUser.raw_user_meta_data?.full_name || supaUser.email.split('@')[0];
        const emailVerified = supaUser.raw_user_meta_data?.email_verified || false;
        const requiresPasswordChange = supaUser.raw_user_meta_data?.requires_password_change || false;
        
        // Activation Status basierend auf last_sign_in_at
        const activationStatus = supaUser.last_sign_in_at ? 'active' : 'pending_activation';

        // User erstellen
        await db.insert(user).values({
          id: newUserId,
          name: fullName,
          email: supaUser.email,
          emailVerified,
          image: null,
          createdAt: new Date(supaUser.created_at),
          updatedAt: new Date(supaUser.updated_at || supaUser.created_at),
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
          updatedAt: new Date(supaUser.updated_at || supaUser.created_at),
        });

        imported++;

        if (imported % 10 === 0) {
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

    offset += BATCH_SIZE;
  }

  console.log('\n📊 Import abgeschlossen!');
  console.log(`   ✅ Importiert: ${imported}`);
  console.log(`   ⏭️  Übersprungen (Duplikate): ${skipped}`);
  console.log(`   ❌ Fehler: ${errors}`);
  console.log(`\n⚠️  WICHTIG: Alle ${imported} User benötigen Password-Reset!`);
}

fastImport()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Import fehlgeschlagen:', err);
    process.exit(1);
  });
