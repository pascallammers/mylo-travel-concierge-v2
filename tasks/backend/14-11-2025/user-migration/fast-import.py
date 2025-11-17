#!/usr/bin/env python3
"""
Fast User Migration: Supabase → Neon
Imports remaining 272 users directly via Neon MCP
"""

import json
import uuid

# We already have 39 users imported, we need to skip those and import the rest
BATCH_SIZE = 100
SKIP_COUNT = 39

print("🚀 Fast User Migration: Supabase → Neon")
print(f"⏭️  Skipping first {SKIP_COUNT} users (already imported)")
print(f"📦 Batch size: {BATCH_SIZE}\n")

# This script generates the SQL statements that can be executed via Neon MCP
# Just copy the output and run it via neon___run_sql_transaction

def generate_user_import_sql(users):
    """Generate SQL for importing users + Better Auth accounts"""
    statements = []
    
    for user_data in users:
        user_id = str(uuid.uuid4())
        email = user_data['email']
        name = user_data.get('raw_user_meta_data', {}).get('full_name', email.split('@')[0])
        
        # User insert
        statements.append(f"""
INSERT INTO "user" (
    id, email, name, image, created_at, updated_at, email_verified, 
    is_active, activation_status, last_active_at, supabase_user_id, raw_user_meta_data
) VALUES (
    '{user_id}',
    '{email}',
    '{name.replace("'", "''")}',
    NULL,
    '{user_data['created_at']}',
    '{user_data['updated_at']}',
    {str(user_data.get('raw_user_meta_data', {}).get('email_verified', False)).lower()},
    true,
    'active',
    {f"'{user_data['last_sign_in_at']}'" if user_data.get('last_sign_in_at') else 'NULL'},
    '{user_data['id']}',
    '{json.dumps(user_data.get('raw_user_meta_data', {})).replace("'", "''")}'
)
""".strip())
        
        # Account insert
        statements.append(f"""
INSERT INTO account (
    id, user_id, account_id, provider_id, password, created_at, updated_at
) VALUES (
    '{str(uuid.uuid4())}',
    '{user_id}',
    '{email}',
    'credential',
    NULL,
    '{user_data['created_at']}',
    '{user_data['updated_at']}'
)
""".strip())
    
    return statements

print("📋 Copy the SQL statements below and run via Neon MCP:")
print("=" * 80)
print(f"\nUSE: neon___run_sql_transaction with projectId='lingering-waterfall-35566132'\n")
print("=" * 80)
