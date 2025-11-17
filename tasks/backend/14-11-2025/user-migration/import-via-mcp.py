#!/usr/bin/env python3
"""
Import Supabase users to Neon via MCP Server
Reads from artifact logs and imports in small batches
"""

import json
import re
from pathlib import Path
import uuid

# Paths
ARTIFACTS = Path.home() / ".factory/artifacts/tool-outputs"
USERS_LOG = ARTIFACTS / "mcp_supabase-pointpilot-chat_execute_sql-toolu_01RDmGkC22P6KmrLueukxFxA-31351002.log"
SUBS_LOG = ARTIFACTS / "mcp_supabase-pointpilot-chat_execute_sql-toolu_01E7Va2e2RprNpbHLvJ8xmjY-31370362.log"
ACCESS_LOG = ARTIFACTS / "mcp_supabase-pointpilot-chat_execute_sql-toolu_016JgEjt5kbfZnoZKgN2yYw6-31350085.log"

OUTPUT_DIR = Path(__file__).parent

def extract_json(log_path):
    """Extract JSON from MCP artifact log"""
    content = log_path.read_text()
    
    # Find untrusted-data tags
    match = re.search(r'<untrusted-data-[^>]+>\s*(\[.*?\])\s*</untrusted-data-', content, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON found in {log_path}")
    
    return json.loads(match.group(1))

def escape_sql(value):
    """Escape value for SQL"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        return f"'{json.dumps(value)}'::json"
    # String
    return f"'{str(value).replace(chr(39), chr(39)+chr(39))}'"

def generate_user_batch_sql(users, start_idx, batch_size=50):
    """Generate SQL for a batch of users"""
    batch = users[start_idx:start_idx + batch_size]
    
    sql_statements = []
    user_mapping = {}
    
    for user in batch:
        new_user_id = str(uuid.uuid4())
        supabase_id = user['id']
        user_mapping[supabase_id] = new_user_id
        
        full_name = user.get('raw_user_meta_data', {}).get('full_name') or user['email'].split('@')[0]
        email_verified = user.get('raw_user_meta_data', {}).get('email_verified', False)
        
        # User insert
        user_sql = f"""INSERT INTO "user" (
  id, name, email, email_verified, image, created_at, updated_at,
  role, is_active, activation_status, last_active_at, supabase_user_id, raw_user_meta_data
) VALUES (
  {escape_sql(new_user_id)},
  {escape_sql(full_name)},
  {escape_sql(user['email'])},
  {escape_sql(email_verified)},
  NULL,
  {escape_sql(user['created_at'])},
  {escape_sql(user['updated_at'])},
  'user',
  {escape_sql(user['is_active'])},
  {escape_sql(user['activation_status'])},
  {escape_sql(user.get('last_active_at'))},
  {escape_sql(supabase_id)},
  {escape_sql(user.get('raw_user_meta_data', {}))}
);"""
        
        # Account insert
        account_id = str(uuid.uuid4())
        account_sql = f"""INSERT INTO account (
  id, account_id, provider_id, user_id, password, created_at, updated_at
) VALUES (
  {escape_sql(account_id)},
  {escape_sql(user['email'])},
  'credential',
  {escape_sql(new_user_id)},
  NULL,
  {escape_sql(user['created_at'])},
  {escape_sql(user['updated_at'])}
);"""
        
        sql_statements.append(user_sql)
        sql_statements.append(account_sql)
    
    return sql_statements, user_mapping

# Load data
print("📦 Loading export data...")
users = extract_json(USERS_LOG)
print(f"✅ Loaded {len(users)} users\n")

# Generate SQL batches
print("🔨 Generating SQL batches...")
batch_num = 1
total_mapping = {}

for start_idx in range(0, len(users), 50):
    statements, mapping = generate_user_batch_sql(users, start_idx, 50)
    total_mapping.update(mapping)
    
    # Save batch SQL
    batch_file = OUTPUT_DIR / f"batch-{batch_num:03d}-users.sql"
    batch_file.write_text('\n\n'.join(statements))
    
    actual_count = min(50, len(users) - start_idx)
    print(f"✅ Batch {batch_num}: {actual_count} users ({start_idx + 1}-{start_idx + actual_count})")
    batch_num += 1

# Save ID mapping
mapping_file = OUTPUT_DIR / "user-id-mapping.json"
mapping_file.write_text(json.dumps(total_mapping, indent=2))

print(f"\n✅ Generated {batch_num - 1} SQL batch files")
print(f"✅ Saved user ID mapping ({len(total_mapping)} mappings)")
print(f"\n📝 Next steps:")
print(f"   1. Import each batch via Neon MCP: neon___run_sql_transaction")
print(f"   2. Then import subscriptions and access control")
