# Phase 1: Environment Configuration Fix

> ### ✅ Current Status: `COMPLETED`
> **Location:** `/active/phase-1-environment-config-fix/`
> **Last Updated:** 2025-01-30

**Priority:** 🔴 Critical
**Estimated Effort:** Small (1-2 hours)
**Prerequisite:** Database + .env.local bereits konfiguriert ✅

## Overview
Die App validiert aktuell ALLE API Keys als `required` in `env/server.ts`, was dazu führt, dass die App nicht startet, selbst wenn nur optionale Features fehlen. Diese Phase macht alle nicht-kritischen API Keys optional, sodass die minimale lauffähige Version nur die absolut notwendigen Keys benötigt.

## Problem Statement
**Aktuelle Situation:**
- `env/server.ts` verwendet `.min(1)` für ALLE Environment Variables
- App crashed beim Start wenn auch nur ein einziger Key fehlt
- User kann nicht testen ohne 30+ API Keys zu beschaffen
- Viele Keys sind nur für optionale Features (TMDB, TripAdvisor, etc.)

**Ziel:**
- Minimale lauffähige Version mit ~5 Keys
- Optionale Features graceful degradation
- Klare Dokumentation welche Keys wofür benötigt werden

## Technical Design

### Environment Variable Kategorien

#### 🔴 CRITICAL (Required for App Start)
```typescript
DATABASE_URL: z.string().min(1)
BETTER_AUTH_SECRET: z.string().min(1)
```

#### 🟡 CORE FEATURES (Required for Basic Functionality)
```typescript
// Mindestens EIN AI Provider (mit Fallback)
XAI_API_KEY: z.string().optional()
GROQ_API_KEY: z.string().optional()
ANTHROPIC_API_KEY: z.string().optional()
OPENAI_API_KEY: z.string().optional()
GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional()

// Mindestens EIN Search Provider (mit Fallback)
TAVILY_API_KEY: z.string().optional()
EXA_API_KEY: z.string().optional()
```

#### 🟢 OPTIONAL FEATURES
```typescript
// Auth Providers (optional, nur wenn OAuth gewünscht)
GITHUB_CLIENT_ID: z.string().optional()
GOOGLE_CLIENT_ID: z.string().optional()
// ... etc

// Tool-specific APIs (optional)
AMADEUS_API_KEY: z.string().optional()
TMDB_API_KEY: z.string().optional()
OPENWEATHER_API_KEY: z.string().optional()
// ... etc
```

### Änderungen Required

**File:** `env/server.ts`

1. **Refactor Schema:**
   - Critical Keys: `.min(1)` behalten
   - AI Providers: `.optional()` mit Runtime-Check
   - Search Providers: `.optional()` mit Runtime-Check
   - Feature-APIs: `.optional()` mit graceful degradation

2. **Runtime Validation:**
   - Beim App-Start checken ob mindestens 1 AI Provider vorhanden
   - Beim App-Start checken ob mindestens 1 Search Provider vorhanden
   - Falls nicht: Klare Error Message welche Keys fehlen

3. **Tool-Level Checks:**
   - Jedes Tool prüft seine eigenen API Keys
   - Falls Key fehlt: Tool wird disabled (nicht in tools array)
   - User bekommt Info: "Feature not available - API Key missing"

### Implementation Details

```typescript
// env/server.ts - NEW STRUCTURE
export const serverEnv = createEnv({
  server: {
    // === CRITICAL (App Won't Start) ===
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    
    // === AI PROVIDERS (Need at least one) ===
    XAI_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    
    // === SEARCH PROVIDERS (Need at least one) ===
    TAVILY_API_KEY: z.string().optional(),
    EXA_API_KEY: z.string().optional(),
    
    // === OPTIONAL FEATURES ===
    // Auth Providers
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    TWITTER_CLIENT_ID: z.string().optional(),
    TWITTER_CLIENT_SECRET: z.string().optional(),
    
    // Infrastructure (optional but recommended)
    REDIS_URL: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    BLOB_READ_WRITE_TOKEN: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    
    // Tool APIs
    AMADEUS_API_KEY: z.string().optional(),
    AMADEUS_API_SECRET: z.string().optional(),
    DAYTONA_API_KEY: z.string().optional(),
    ELEVENLABS_API_KEY: z.string().optional(),
    TMDB_API_KEY: z.string().optional(),
    YT_ENDPOINT: z.string().optional(),
    FIRECRAWL_API_KEY: z.string().optional(),
    PARALLEL_API_KEY: z.string().optional(),
    OPENWEATHER_API_KEY: z.string().optional(),
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    VALYU_API_KEY: z.string().optional(),
    SMITHERY_API_KEY: z.string().optional(),
    COINGECKO_API_KEY: z.string().optional(),
    SUPERMEMORY_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    
    ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3000'),
  },
  experimental__runtimeEnv: process.env,
});

// Runtime checks
function validateMinimumConfig() {
  const aiProviders = [
    serverEnv.XAI_API_KEY,
    serverEnv.GROQ_API_KEY,
    serverEnv.ANTHROPIC_API_KEY,
    serverEnv.OPENAI_API_KEY,
    serverEnv.GOOGLE_GENERATIVE_AI_API_KEY,
  ].filter(Boolean);
  
  if (aiProviders.length === 0) {
    throw new Error(
      '⚠️  No AI Provider configured! Please set at least one:\n' +
      '   - XAI_API_KEY (recommended)\n' +
      '   - GROQ_API_KEY\n' +
      '   - ANTHROPIC_API_KEY\n' +
      '   - OPENAI_API_KEY\n' +
      '   - GOOGLE_GENERATIVE_AI_API_KEY'
    );
  }
  
  const searchProviders = [
    serverEnv.TAVILY_API_KEY,
    serverEnv.EXA_API_KEY,
  ].filter(Boolean);
  
  if (searchProviders.length === 0) {
    console.warn(
      '⚠️  No Search Provider configured. Web search will be limited.\n' +
      '   Recommended: TAVILY_API_KEY or EXA_API_KEY'
    );
  }
  
  console.log('✅ Environment configuration valid');
  console.log(`   - AI Providers: ${aiProviders.length}`);
  console.log(`   - Search Providers: ${searchProviders.length}`);
}

// Call on module load
validateMinimumConfig();

export { validateMinimumConfig };
```

**File:** `ai/providers.ts`

```typescript
// Filter models based on available API keys
export function getAvailableModels(): Model[] {
  return models.filter(model => {
    // Check if required provider API key exists
    if (model.value.includes('grok')) return !!serverEnv.XAI_API_KEY;
    if (model.value.includes('qwen') || model.value.includes('glm')) return !!serverEnv.GROQ_API_KEY;
    if (model.value.includes('anthropic') || model.value.includes('claude')) return !!serverEnv.ANTHROPIC_API_KEY;
    // ... etc
    return true; // Default: available
  });
}
```

**File:** `app/api/search/route.ts`

```typescript
// Conditional tool loading
const tools = {
  // Always available
  greeting: greetingTool(timezone),
  datetime: datetimeTool,
  text_translate: textTranslateTool,
  
  // Conditional based on API keys
  ...(serverEnv.TAVILY_API_KEY || serverEnv.EXA_API_KEY ? {
    web_search: webSearchTool(dataStream, searchProvider),
  } : {}),
  
  ...(serverEnv.AMADEUS_API_KEY ? {
    track_flight: flightTrackerTool,
  } : {}),
  
  ...(serverEnv.OPENWEATHER_API_KEY ? {
    get_weather_data: weatherTool,
  } : {}),
  
  // ... etc
};
```

## Functional Requirements
- [ ] App startet mit nur DATABASE_URL + BETTER_AUTH_SECRET + 1 AI Provider
- [ ] Klare Error Messages wenn kritische Keys fehlen
- [ ] Runtime Check für mindestens 1 AI Provider
- [ ] Runtime Warning (nicht Error) für fehlende Search Provider
- [ ] Tools werden nur geladen wenn ihre API Keys vorhanden
- [ ] Model Selector zeigt nur verfügbare Models
- [ ] User bekommt Info wenn Feature disabled wegen fehlendem Key

## Non-Functional Requirements
- [ ] Backward compatible (bestehende .env.local funktioniert weiter)
- [ ] Keine Breaking Changes für existierende Deployments
- [ ] Startup Zeit nicht signifikant erhöht
- [ ] Hilfreiche Developer Experience mit klaren Errors

## Success Criteria
✅ **Minimal Setup funktioniert:**
```bash
# Nur diese 3 Keys required
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=random-secret
XAI_API_KEY=xai-...

# App startet erfolgreich
npm run dev
# ✅ Environment configuration valid
# ✅ AI Providers: 1
# ⚠️  No Search Provider configured...
```

✅ **Optional Features degradieren graceful:**
- Keine Flights -> Track Flight Tool nicht verfügbar
- Keine Weather API -> Weather Tool nicht verfügbar
- Kein Search Provider -> Web Search begrenzt/disabled

✅ **Developer Experience:**
- Klare Error Messages
- Startup Feedback welche Features available
- Dokumentation welche Keys wofür

## Testing Checklist
- [ ] App startet mit nur DATABASE_URL + AUTH_SECRET + 1 AI Provider
- [ ] Error Message wenn kein AI Provider
- [ ] Warning (nicht Error) wenn kein Search Provider
- [ ] Chat funktioniert mit minimalem Setup
- [ ] Tools werden conditional geladen
- [ ] Model Selector zeigt nur Models mit verfügbaren Keys
- [ ] Bestehende .env.local mit allen Keys funktioniert weiter

## Dependencies
- ✅ Database bereits auf Neon
- ✅ .env.local bereits konfiguriert mit Keys
- ✅ Drizzle Migrations bereits durchgeführt

## Risks & Mitigation
- **Risk:** Bestehende Deployments brechen
- **Mitigation:** Backward compatible - alte Config funktioniert weiter

- **Risk:** User versteht nicht welche Keys benötigt
- **Mitigation:** Klare Error Messages + .env.example Update

## Timeline Estimate
- Implementation: 1 hour
- Testing: 30 minutes
- Documentation: 30 minutes
**Total: ~2 hours**

## Deliverables
1. ✅ Refactored `env/server.ts` mit optional Keys
2. ✅ Runtime validation mit hilfreichen Messages
3. ✅ Updated `.env.example` mit Key-Kategorien dokumentiert
4. ✅ Conditional tool loading in `app/api/search/route.ts`
5. ✅ Model filtering basierend auf verfügbaren Keys
6. ✅ README.md Update mit Minimal Setup Anleitung

## Next Steps
Nach Completion dieser Phase:
→ **Phase 2:** Seats.Aero Integration kann starten
→ App ist lauffähig für basic Testing
→ Weitere Features können iterativ hinzugefügt werden

## References
- [Environment Variables Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [T3 Env Documentation](https://env.t3.gg/docs/nextjs)
- → Related: [Phase 2 - Seats.Aero Integration](../phase-2-seats-aero-integration/spec.md)
