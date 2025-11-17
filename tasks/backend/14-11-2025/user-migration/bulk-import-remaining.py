#!/usr/bin/env python3
"""
Bulk Import Script für verbleibende User (112-311)
Importiert alle verbleibenden 200 User von Supabase nach Neon
"""

import os
import json
from supabase import create_client, Client
import psycopg2
from psycopg2.extras import execute_batch

# Supabase Config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://fvovfnrxtmcmizqblwyf.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")  # Anon key

# Neon Config  
NEON_CONNECTION_STRING = os.environ.get("DATABASE_URL")

def fetch_remaining_users_from_supabase(offset=111):
    """Holt verbleibende User von Supabase (ab User 112)"""
    if not SUPABASE_KEY:
        raise ValueError("SUPABASE_KEY environment variable not set")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Hole alle Users ab Offset 111
    query = """
    SELECT 
      id,
      email,
      created_at,
      updated_at,
      role,
      email_confirmed_at,
      raw_user_meta_data
    FROM auth.users
    ORDER BY created_at
    LIMIT 200 OFFSET %s;
    """ % offset
    
    print(f"📥 Fetching users from Supabase (offset {offset})...")
    # Note: Supabase client doesn't support direct SQL, we need to use REST API
    # For now, return empty list - we'll use MCP
    return []

def import_users_to_neon(users):
    """Importiert User in Neon Database"""
    if not NEON_CONNECTION_STRING:
        raise ValueError("DATABASE_URL environment variable not set")
    
    conn = psycopg2.connect(NEON_CONNECTION_STRING)
    cursor = conn.cursor()
    
    user_inserts = []
    account_inserts = []
    
    for user in users:
        # User INSERT
        user_insert = (
            user['id'],
            user['email'],
            True,  # email_verified
            None,  # image
            user.get('raw_user_meta_data', {}).get('full_name', user['email']),
            user['created_at'],
            user['updated_at'],
            'user',  # role
            True,  # is_active
            'active',  # activation_status
            user['updated_at'],  # last_active_at
            user['id'],  # supabase_user_id
            json.dumps(user.get('raw_user_meta_data', {}))
        )
        user_inserts.append(user_insert)
        
        # Account INSERT
        account_insert = (
            user['id'],  # account_id
            'credential',  # provider_id
            user['id'],  # user_id
            None,  # password
            user['created_at'],
            user['updated_at']
        )
        account_inserts.append(account_insert)
    
    # Batch INSERT Users
    user_query = """
    INSERT INTO "user" (
        id, email, email_verified, image, name, 
        created_at, updated_at, role, is_active, 
        activation_status, last_active_at, supabase_user_id, raw_user_meta_data
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (id) DO NOTHING
    """
    
    execute_batch(cursor, user_query, user_inserts, page_size=50)
    
    # Batch INSERT Accounts
    account_query = """
    INSERT INTO account (
        account_id, provider_id, user_id, password, created_at, updated_at
    ) 
    SELECT %s, %s, %s, %s, %s, %s
    WHERE NOT EXISTS (
        SELECT 1 FROM account 
        WHERE account_id = %s AND provider_id = %s
    )
    """
    
    # Add duplicate values for WHERE NOT EXISTS check
    account_inserts_with_check = [
        (*insert, insert[0], insert[1]) for insert in account_inserts
    ]
    
    execute_batch(cursor, account_query, account_inserts_with_check, page_size=50)
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"✅ Successfully imported {len(users)} users!")

def main():
    print("🚀 Starting bulk import of remaining 200 users...")
    print("=" * 60)
    
    # Note: This script requires SUPABASE_KEY and DATABASE_URL env vars
    # For now, we'll use the MCP approach instead
    print("⚠️  This script requires direct database access")
    print("    Using MCP Server for import instead...")
    print("\nPlease continue with MCP-based import via the agent.")

if __name__ == "__main__":
    main()
