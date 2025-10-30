#!/bin/bash

echo "🧪 Testing GPT-5 API..."
echo ""

response=$(curl -s -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-'$(date +%s)'",
    "messages": [{"id": "msg-1", "role": "user", "content": "Sage Hallo", "parts": [{"type": "text", "text": "Sage Hallo"}]}],
    "model": "gpt-5",
    "group": "web",
    "timezone": "Europe/Berlin",
    "selectedVisibilityType": "private",
    "isCustomInstructionsEnabled": false,
    "searchProvider": "parallel"
  }' 2>&1)

echo "Response:"
echo "$response" | head -20
echo ""

if echo "$response" | grep -q "Good afternoon\|Hallo\|Hello"; then
  echo "✅ API funktioniert! GPT-5 antwortet."
else
  echo "❌ Problem: API antwortet nicht korrekt"
  echo ""
  echo "Mögliche Ursachen:"
  echo "1. Server läuft nicht (pnpm dev)"
  echo "2. .env.local fehlen Variablen"
  echo "3. OPENAI_API_KEY ist falsch"
fi

