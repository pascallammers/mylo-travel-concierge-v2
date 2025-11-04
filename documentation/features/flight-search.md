# Flight Search Feature Documentation

## Overview

The Flight Search feature enables users to search for flights using natural language queries in German. It integrates two powerful APIs to provide comprehensive results:

- **Seats.aero**: Award flight search (miles/points)
- **Amadeus**: Cash flight search (paid tickets)

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                   Chat Interface                     │
│              (German Language Input)                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│              MYLO System Instructions                │
│         (IATA Code Conversion & Tool Selection)      │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│            Flight Search Tool (Vercel AI SDK)        │
│              lib/tools/flight-search.ts              │
└────┬─────────────────────────────────────┬──────────┘
     │                                     │
     ▼                                     ▼
┌──────────────────────┐        ┌──────────────────────┐
│  Seats.aero Client   │        │   Amadeus Client     │
│ (Award Flights)      │        │  (Cash Flights)      │
└──────────────────────┘        └──────────────────────┘
     │                                     │
     └──────────────┬──────────────────────┘
                    │
                    ▼
           ┌─────────────────────┐
           │  Tool-Call Registry │
           │  (Deduplication)    │
           └─────────────────────┘
                    │
                    ▼
           ┌─────────────────────┐
           │   Session State     │
           │  (User Context)     │
           └─────────────────────┘
```

### Database Schema

#### 1. Tool Calls Registry (`tool_calls`)
```sql
CREATE TABLE tool_calls (
  id SERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  parameters JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error TEXT,
  execution_time INTEGER,
  dedupe_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

**Purpose:** Track all tool calls with SHA256 deduplication to prevent duplicate API calls.

#### 2. Session States (`session_states`)
```sql
CREATE TABLE session_states (
  id SERIAL PRIMARY KEY,
  chat_id TEXT UNIQUE NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Store user context and search history per chat session.

#### 3. Amadeus Tokens (`amadeus_tokens`)
```sql
CREATE TABLE amadeus_tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Cache OAuth2 tokens from Amadeus API to minimize token requests.

## API Integration

### Seats.aero

**Purpose:** Search for award flights using frequent flyer miles/points

**Features:**
- Multi-cabin class support (Economy, Premium Economy, Business, First)
- Date flexibility (±3 days)
- Real-time availability and seat counts
- Direct booking links
- Multiple airline support

**Configuration:**
```bash
SEATSAERO_API_KEY=your_api_key
```

**Rate Limits:** Check Seats.aero documentation

### Amadeus Flight Offers API v2

**Purpose:** Search for cash flights (paid tickets)

**Features:**
- One-way and round-trip support
- Multiple passengers
- Cabin class filtering
- Price in local currency
- Real-time pricing

**Configuration:**
```bash
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
AMADEUS_ENVIRONMENT=test  # or 'production'
```

**OAuth2 Token Management:**
- Tokens cached in database
- Automatic refresh when expired
- 5-minute buffer before expiration

## Tool Parameters

### `search_flights`

```typescript
{
  origin: string;              // IATA code (e.g., "FRA")
  destination: string;          // IATA code (e.g., "JFK")
  departureDate: string;        // YYYY-MM-DD format
  returnDate?: string;          // Optional, YYYY-MM-DD format
  cabinClass: 'economy' | 'premium' | 'business' | 'first';
  passengers: number;           // Default: 1
  searchAwardFlights: boolean;  // Search Seats.aero
  searchCashFlights: boolean;   // Search Amadeus
  preferredAirlines?: string[]; // Optional IATA airline codes
  maxStops?: number;            // Optional, 0 = direct only
  flexibleDates?: boolean;      // Optional, search ±3 days
}
```

## System Instructions (German)

MYLO acts as an intelligent travel concierge that:

1. **IATA Code Conversion:** Automatically converts city names to airport codes
2. **Parameter Inference:** Extracts search parameters from natural language
3. **Bilingual Support:** Accepts English or German, always responds in German
4. **Error Handling:** Provides helpful messages for common issues

### Example Conversations

**Query:** "Zeig mir Flüge von München nach New York im Juni"

**MYLO Response:**
```
✈️ Award-Flüge (Meilen)

**Lufthansa LH400** - Direktflug [Seats.aero](...)
- München (MUC) → New York JFK
- Abflug: 10:30 - Ankunft: 14:15 (8h 45min)
- Business Class: 70.000 Miles + 280 EUR
- 4 Sitze verfügbar

💳 Cash-Flüge

**United UA960** - Direktflug [Amadeus API](...)
- München (MUC) → New York JFK
- Abflug: 14:20 - Ankunft: 18:05 (8h 45min)
- Business Class: 1.850 EUR
- Direktflug
```

## Performance

### Targets

- **Response Time:** <5 seconds (95th percentile)
- **Token Cache Hit Rate:** >90%
- **Deduplication Rate:** 100% for identical queries
- **API Success Rate:** >95%

### Optimization

1. **Parallel Execution:** Both APIs called simultaneously via `Promise.all`
2. **Token Caching:** Amadeus tokens cached in database
3. **Deduplication:** SHA256 hash prevents duplicate API calls
4. **Error Recovery:** Graceful degradation if one API fails

## Feature Flag

### Configuration

```typescript
// lib/features.ts
FLIGHT_SEARCH: {
  enabled: process.env.NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH === 'true',
  description: 'Enable flight search tool',
  requiresAuth: false,
  requiresPro: false,
}
```

### Usage

```typescript
import { isFeatureEnabled } from '@/lib/features';

if (isFeatureEnabled('FLIGHT_SEARCH')) {
  // Show flight search UI
}
```

## Deployment

### Environment Variables (Vercel)

**Required:**
```
SEATSAERO_API_KEY=xxx
AMADEUS_CLIENT_ID=xxx
AMADEUS_CLIENT_SECRET=xxx
AMADEUS_ENVIRONMENT=production
NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=true
```

**Database:**
```
DATABASE_URL=postgresql://...
```

### Staging Deployment

1. Deploy to Vercel preview
2. Set environment variables
3. Enable feature flag: `NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=true`
4. Run manual test checklist
5. Verify performance metrics

### Production Rollout

1. Start with feature flag disabled
2. Deploy to production
3. Gradually enable: `NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=true`
4. Monitor error rates and performance
5. Full rollout after 24-48 hours

### Rollback Plan

1. **Quick Rollback:** Disable feature flag
   ```
   NEXT_PUBLIC_ENABLE_FLIGHT_SEARCH=false
   ```

2. **Full Rollback:** Use Vercel rollback
   ```bash
   vercel rollback
   ```

3. **Database Rollback:** If needed, run rollback migration
   ```bash
   npx drizzle-kit drop
   # Then re-apply previous migration
   ```

## Monitoring

### Metrics to Track

1. **API Success Rates:**
   - Seats.aero success rate
   - Amadeus success rate
   - Overall success rate

2. **Performance:**
   - p50, p95, p99 response times
   - API latency breakdown
   - Database query times

3. **Token Management:**
   - Cache hit rate
   - Token refresh frequency
   - Token retrieval failures

4. **Deduplication:**
   - Duplicate query rate
   - Cache effectiveness

### Error Tracking

- API errors (4xx, 5xx)
- Token retrieval failures
- Database errors
- Invalid parameters
- Rate limiting

### Logs

```typescript
// Example log structure
{
  tool: 'search_flights',
  parameters: { origin: 'FRA', destination: 'JFK' },
  seatsaero_status: 'success',
  amadeus_status: 'success',
  total_results: 15,
  execution_time: 3200,
  cache_hit: false
}
```

## Testing

See [TESTING.md](../../TESTING.md) for complete testing guide.

### Manual Test Checklist

- [ ] Business Class Transatlantic (FRA → JFK)
- [ ] Award Flights Only
- [ ] Round-Trip (MUC → NRT)
- [ ] Direct Flights Only
- [ ] First Class with Miles & More
- [ ] Invalid dates handling
- [ ] Invalid airport codes handling
- [ ] API failure scenarios

## Known Limitations

1. **API Rate Limits:** Subject to Seats.aero and Amadeus rate limits
2. **Real-Time Pricing:** Prices may change between search and booking
3. **Availability:** Seats may sell out quickly, especially award seats
4. **IATA Codes:** Requires valid 3-letter airport codes
5. **Language:** System instructions are German-focused

## Future Enhancements

- [ ] Multi-city flights (complex itineraries)
- [ ] Price alerts and monitoring
- [ ] Seat maps and cabin layouts
- [ ] Baggage policy information
- [ ] Loyalty program integration
- [ ] Hotel and car rental bundling
- [ ] Travel restrictions and visa requirements
- [ ] Carbon footprint calculations

## Support

For issues or questions:
- Check [TESTING.md](../../TESTING.md)
- Review Vercel deployment logs
- Check database logs for errors
- Verify environment variables
- Contact Seats.aero or Amadeus support for API issues

## References

- [Seats.aero API Documentation](https://seats.aero/api)
- [Amadeus Flight Offers API](https://developers.amadeus.com/self-service/category/flights)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
