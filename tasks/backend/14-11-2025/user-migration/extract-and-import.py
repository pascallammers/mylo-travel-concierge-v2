#!/usr/bin/env python3
"""
Extrahiert User aus Artifact-Log und generiert SQL für Neon Import
"""
import json
import re
import sys

ARTIFACT_PATH = '/Users/pascallammers/.factory/artifacts/tool-outputs/mcp_supabase-pointpilot-chat_execute_sql-toolu_01S88MKo5DGwjnsD5vRXoGt7-36131729.log'

def extract_json_from_log(file_path):
    """Extrahiert JSON aus dem MCP Log"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Finde JSON zwischen untrusted-data Tags
    pattern = r'<untrusted-data-[^>]+>\n?\[.*?\]\n?</untrusted-data-'
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        print("❌ Konnte JSON nicht finden!")
        return None
    
    # Extrahiere nur das JSON Array
    json_str = match.group(0)
    json_str = re.sub(r'<untrusted-data-[^>]+>\n?', '', json_str)
    json_str = re.sub(r'\n?</untrusted-data-.*', '', json_str)
    
    return json.loads(json_str)

def generate_import_sql(users):
    """Generiert SQL für Neon Import"""
    print(f"📝 Generiere SQL für {len(users)} User...\n")
    
    sql_file = 'tasks/backend/14-11-2025/user-migration/bulk-import.sql'
    
    with open(sql_file, 'w', encoding='utf-8') as f:
        f.write("-- Bulk Import von 252 Usern\n")
        f.write("-- Generiert am 14.11.2025\n\n")
        f.write("BEGIN;\n\n")
        
        for i, user_data in enumerate(users, 1):
            full_name = user_data.get('full_name') or user_data['email'].split('@')[0]
            last_sign_in = user_data.get('last_sign_in_at')
            activation_status = 'active' if last_sign_in else 'inactive'
            
            # Escape single quotes
            full_name = full_name.replace("'", "''")
            email = user_data['email'].replace("'", "''")
            raw_meta = json.dumps(user_data.get('raw_user_meta_data', {})).replace("'", "''")
            
            # User INSERT
            f.write(f"-- User {i}: {email}\n")
            f.write(f"WITH new_user AS (\n")
            f.write(f"  INSERT INTO \"user\" (id, email, name, image, created_at, updated_at, email_verified, is_active, activation_status, last_active_at, supabase_user_id, raw_user_meta_data)\n")
            f.write(f"  VALUES (\n")
            f.write(f"    gen_random_uuid(),\n")
            f.write(f"    '{email}',\n")
            f.write(f"    '{full_name}',\n")
            f.write(f"    NULL,\n")
            f.write(f"    '{user_data['created_at']}',\n")
            f.write(f"    '{user_data['updated_at']}',\n")
            f.write(f"    true,\n")
            f.write(f"    true,\n")
            f.write(f"    '{activation_status}',\n")
            last_active_val = f"'{last_sign_in}'" if last_sign_in else 'NULL'
            f.write(f"    {last_active_val},\n")
            f.write(f"    '{user_data['id']}',\n")
            f.write(f"    '{raw_meta}'\n")
            f.write(f"  )\n")
            f.write(f"  RETURNING id\n")
            f.write(f")\n")
            
            # Account INSERT
            f.write(f"INSERT INTO account (id, user_id, account_id, provider_id, password, created_at, updated_at)\n")
            f.write(f"SELECT gen_random_uuid(), id, '{email}', 'credential', NULL, NOW(), NOW()\n")
            f.write(f"FROM new_user;\n\n")
            
            if i % 50 == 0:
                print(f"   ✅ {i} SQL Statements generiert...")
        
        f.write("COMMIT;\n")
    
    print(f"\n✅ SQL-Datei erstellt: {sql_file}")
    print(f"📊 {len(users)} User bereit für Import\n")
    print(f"▶️  Ausführen mit:")
    print(f"   psql \"<CONNECTION_STRING>\" -f {sql_file}")
    
    return sql_file

# Main
print("🚀 Extrahiere User aus Artifact-Log\n")
users = extract_json_from_log(ARTIFACT_PATH)

if users:
    print(f"✅ {len(users)} User gefunden\n")
    generate_import_sql(users)
else:
    print("❌ Keine User gefunden!")
    sys.exit(1)
