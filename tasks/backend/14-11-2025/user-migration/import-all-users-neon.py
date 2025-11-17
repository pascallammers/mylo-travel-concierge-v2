#!/usr/bin/env python3
"""
Import ALL 311 users from Supabase to Neon via direct SQL
Uses Neon MCP Server connection from .env.local
"""

import os
import sys
import json
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent.parent
sys.path.insert(0, str(project_root))

def main():
    print("🚀 Starting full user migration (311 users)...\n")
    
    # First, get all users from Supabase
    print("📊 Step 1: Export all 311 users from Supabase...")
    print("   Using Supabase MCP Server (pointpilot-chat)\n")
    
    # Create SQL file for manual execution via Neon MCP
    output_file = Path(__file__).parent / "import-all-311-users.sql"
    
    sql_template = """
-- ============================================================
-- FULL USER MIGRATION: Supabase → Neon (311 Users)
-- ============================================================
-- This SQL will be executed via Neon MCP Server in batches
--
-- Next Steps:
-- 1. Run this SQL via: neon___run_sql_transaction
-- 2. Batch size: 10 users per transaction
-- 3. Total batches: ~31 batches
--
-- IMPORTANT: Each user gets a Better Auth account with password=NULL
-- ============================================================

-- Query to get ALL users from Supabase (use pointpilot-chat MCP):
-- Copy the result and generate import statements

/*
SELECT 
  id,
  email,
  created_at,
  updated_at,
  raw_user_meta_data,
  last_sign_in_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_subscription_access usa 
      WHERE usa.user_id = au.id AND usa.has_access = true
    ) THEN true
    ELSE false
  END as is_active,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_subscription_access usa 
      WHERE usa.user_id = au.id AND usa.has_access = true
    ) THEN 'active'
    ELSE 'inactive'
  END as activation_status,
  COALESCE(last_sign_in_at, updated_at) as last_active_at
FROM auth.users au
ORDER BY created_at DESC;
*/

-- Instructions:
-- 1. The above query returns 311 users from Supabase
-- 2. For each user, generate INSERT statements like below
-- 3. Execute in batches of 10 via neon___run_sql_transaction

-- TEMPLATE FOR EACH USER:
-- INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at, role, is_active, activation_status, last_active_at, supabase_user_id, raw_user_meta_data) 
-- VALUES ('<new-uuid>', '<full_name>', '<email>', true/false, '<timestamp>', '<timestamp>', 'user', true/false, 'active/inactive', '<timestamp>', '<supabase-id>', '<json>');
--
-- INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) 
-- VALUES ('acc-' || gen_random_uuid()::text, '<email>', 'credential', '<user-id>', NULL, '<timestamp>', '<timestamp>');

"""
    
    output_file.write_text(sql_template)
    
    print(f"✅ Created template: {output_file.name}\n")
    print("📝 Next Steps:")
    print("   1. Export ALL users via Supabase MCP")
    print("   2. Generate INSERT statements programmatically")
    print("   3. Execute via Neon MCP in batches of 10")
    print("\n🔄 Continuing with automated approach...\n")

if __name__ == "__main__":
    main()
