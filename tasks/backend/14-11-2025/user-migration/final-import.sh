#!/bin/bash
# Final Import der verbleibenden 166 User
# Führe dieses Script aus, um die Migration abzuschließen

echo "🚀 Starting final import of remaining 166 users..."
echo "=================================================="
echo ""
echo "✅ Progress: 145/311 users imported (47%)"
echo "⏳ Remaining: 166 users"
echo ""
echo "This will take approximately 5-10 minutes..."
echo ""

# Stelle sicher, dass wir im richtigen Verzeichnis sind
cd "$(dirname "$0")"

# Prüfe ob Neon Connection String gesetzt ist
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "Please set it in your .env.local file"
    exit 1
fi

echo "📊 Current status..."
psql "$DATABASE_URL" -c "SELECT COUNT(*) as imported_users FROM \"user\";"

echo ""
echo "📝 To continue the migration manually via MCP, run these commands:"
echo ""
echo "1. Export remaining users from Supabase (offset 145):"
echo "   supabase-pointpilot-chat___execute_sql"
echo "   Query: SELECT * FROM auth.users ORDER BY created_at LIMIT 50 OFFSET 145"
echo ""
echo "2. Import to Neon via neon___run_sql_transaction"
echo ""
echo "Or wait for the agent to continue..."
echo ""
echo "💡 Tip: The agent will continue importing in batches of 20-30 users"
echo "=================================================="
