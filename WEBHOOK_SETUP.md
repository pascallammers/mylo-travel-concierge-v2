# 🔗 MYLO Webhook Setup - User Creation

## Übersicht

MYLO nutzt einen Webhook-basierten Ansatz für die User-Erstellung. Kunden werden **automatisch angelegt**, nachdem sie das Produkt gekauft haben.

---

## 🎯 User Journey

```mermaid
Kunde kauft Produkt
    ↓
Zapier/Webhook feuert
    ↓
POST /api/webhooks/create-user
    ↓
User wird in DB angelegt
    ↓
Zufälliges Passwort generiert
    ↓
Welcome-E-Mail mit Login-Daten (Resend)
    ↓
Kunde öffnet MYLO → /sign-in
    ↓
Login mit E-Mail + Passwort
```

---

## 📋 Webhook Endpoint

### URL
```
POST https://deine-domain.de/api/webhooks/create-user
```

### Request Body
```json
{
  "email": "kunde@example.com",
  "firstName": "Max",              // Optional
  "lastName": "Mustermann",        // Optional
  "webhookSecret": "your-secret-key"
}
```

### Response (Success)
```json
{
  "success": true,
  "userId": "user-id-here",
  "message": "User created and welcome email sent"
}
```

### Response (User exists)
```json
{
  "message": "User already exists",
  "userId": "existing-user-id",
  "alreadyExists": true
}
```

### Response (Error)
```json
{
  "error": "Invalid email address"
}
```

---

## 🔐 Environment Variables

### Erforderlich

```bash
# .env.local
WEBHOOK_SECRET=dein-super-geheimes-token
RESEND_API_KEY=re_xxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://deine-domain.de
DATABASE_URL=postgresql://...
```

---

## 🔧 Zapier Setup

### 1. Trigger erstellen
- **App**: WooCommerce / Stripe / etc.
- **Event**: "New Order" oder "Payment Succeeded"

### 2. Action konfigurieren
- **App**: Webhooks by Zapier
- **Event**: POST Request

### 3. Webhook URL
```
https://deine-domain.de/api/webhooks/create-user
```

### 4. Payload Type
`application/json`

### 5. Data (JSON)
```json
{
  "email": "{{customer_email}}",
  "firstName": "{{customer_first_name}}",
  "lastName": "{{customer_last_name}}",
  "webhookSecret": "dein-webhook-secret"
}
```

---

## 🧪 Lokal Testen

### 1. Server starten
```bash
npm run dev
```

### 2. Webhook aufrufen
```bash
curl -X POST http://localhost:3000/api/webhooks/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "webhookSecret": "mylo-webhook-secret-change-in-production"
  }'
```

### 3. Erwartete Antwort
```json
{
  "success": true,
  "userId": "...",
  "message": "User created and welcome email sent"
}
```

### 4. E-Mail prüfen
- Postfach von `test@example.com` öffnen
- Welcome-E-Mail mit Login-Daten sollte da sein

---

## 📧 Welcome-E-Mail

### Inhalt
```
🎉 Willkommen bei MYLO!

Hallo [Vorname],

vielen Dank für deinen Kauf! Dein MYLO Travel-Concierge ist jetzt bereit.

Deine Zugangsdaten:
E-Mail: kunde@example.com
Passwort: AbC123XyZ

⚠️ Wichtig: Bitte ändere dein Passwort nach dem ersten Login in den Einstellungen.

[Jetzt anmelden] → https://deine-domain.de/sign-in
```

---

## 🛡️ Sicherheit

### Webhook Secret
- **Niemals** in Git committen
- In Vercel/Production als Environment Variable setzen
- Bei jedem Request validieren

### Passwörter
- Werden automatisch als 12-stellige Base64-Strings generiert
- Werden von Better Auth gehasht
- Nur einmalig per E-Mail versendet

---

## 🚀 Production Deployment

### 1. Resend Domain verifizieren
```bash
# In Resend Dashboard:
1. Domain hinzufügen (z.B. scira.ai)
2. DNS-Records (SPF, DKIM) setzen
3. Verifizierung abwarten
```

### 2. Environment Variables setzen
```bash
vercel env add WEBHOOK_SECRET
vercel env add RESEND_API_KEY
vercel env add NEXT_PUBLIC_APP_URL
```

### 3. FROM_EMAIL anpassen
In `lib/email.ts`:
```typescript
const FROM_EMAIL = 'MYLO <noreply@deine-domain.de>';
```

### 4. Zapier auf Production umstellen
- Webhook-URL auf `https://deine-domain.de/api/webhooks/create-user` ändern
- Test-Purchase durchführen
- User-Creation + E-Mail prüfen

---

## 🔍 Troubleshooting

### User wird nicht angelegt
1. Logs prüfen: `vercel logs`
2. WEBHOOK_SECRET korrekt?
3. E-Mail valide?

### E-Mail kommt nicht an
1. Resend Dashboard prüfen
2. Domain verifiziert?
3. SPF/DKIM korrekt gesetzt?

### Passwort funktioniert nicht
1. Sicherstellen, dass Passwort korrekt kopiert wurde
2. Passwort-Reset verwenden: `/reset-password`

---

## 📚 Weitere Infos

- [Better Auth Docs](https://www.better-auth.com)
- [Resend Docs](https://resend.com/docs)
- [Zapier Webhooks](https://zapier.com/apps/webhook/integrations)
