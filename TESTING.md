# Testing Guide - V1 to V2 Flight Search Migration

This document describes the testing approach for Phase 6 of the V1 to V2 tool-calling migration.

## Test Overview

### Test Framework
- **Node.js Built-in Test Runner** with `tsx` for TypeScript support
- No additional dependencies required
- Simple, fast, and native to Node.js

### Test Structure

```
lib/
├── api/
│   ├── seats-aero-client.test.ts       # Unit tests for Seats.aero API
│   ├── amadeus-client.test.ts          # Unit tests for Amadeus API
│   └── amadeus-token.test.ts           # Unit tests for token management
├── db/
│   └── queries/
│       └── tool-calls.test.ts          # Unit tests for tool-call registry
└── tools/
    └── flight-search.integration.test.ts  # Integration tests for complete flow
```

## Running Tests

### Run All Tests
```bash
npx tsx --test "lib/**/*.test.ts"
```

### Run Specific Test Suites

#### API Client Tests
```bash
# Seats.aero Client
npx tsx --test lib/api/seats-aero-client.test.ts

# Amadeus Client
npx tsx --test lib/api/amadeus-client.test.ts

# Amadeus Token Management
npx tsx --test lib/api/amadeus-token.test.ts
```

#### Database Tests
```bash
# Tool-Call Registry
npx tsx --test lib/db/queries/tool-calls.test.ts
```

#### Integration Tests
```bash
# Complete Flight Search Flow
npx tsx --test lib/tools/flight-search.integration.test.ts
```

### Run Tests with Coverage (if available)
```bash
npx tsx --test --experimental-test-coverage "lib/**/*.test.ts"
```

## Test Coverage

### Unit Tests

#### 1. Seats.aero Client (`lib/api/seats-aero-client.test.ts`)
- ✅ Business class search
- ✅ API error handling
- ✅ Date flexibility logic (±3 days)
- ✅ Result filtering by cabin class
- ✅ Missing API key handling
- ✅ Cabin class mapping (economy, premium, business, first)
- ✅ Network error handling

#### 2. Amadeus Client (`lib/api/amadeus-client.test.ts`)
- ✅ Cash flight search
- ✅ Return date handling (round-trip)
- ✅ Multiple passengers
- ✅ API error handling
- ✅ Token retrieval failure
- ✅ Cabin class mapping to Amadeus format
- ✅ Network error handling

#### 3. Amadeus Token Manager (`lib/api/amadeus-token.test.ts`)
- ✅ Cached token retrieval
- ✅ New token request when expired
- ✅ New token request when no cache exists
- ✅ Amadeus API error handling
- ✅ Network error handling
- ✅ Missing credentials handling
- ✅ Token cleanup (expired tokens)
- ✅ Token caching behavior
- ✅ Token refresh when expiration is near (<5 min)

#### 4. Tool-Call Registry (`lib/db/queries/tool-calls.test.ts`)
- ✅ Tool call recording
- ✅ Deduplication via SHA256 hash
- ✅ Status updates (pending → running → completed/failed)
- ✅ Tool call retrieval by ID
- ✅ Deduplication within same chat session
- ✅ Different chats allow same queries
- ✅ Parameter order variations
- ✅ Status transitions

### Integration Tests

#### 5. Flight Search Tool (`lib/tools/flight-search.integration.test.ts`)
- ✅ Complete search with award + cash flights
- ✅ Award flights only
- ✅ Cash flights only
- ✅ Parallel API execution (Promise.all)
- ✅ Continue when one API fails
- ✅ Session state updates with search parameters
- ✅ Tool-call recording before execution
- ✅ Tool-call updates with results after execution
- ✅ Tool-call failure handling
- ✅ German response formatting

## Manual Testing Checklist

### Test Queries (German)

1. **Business Class Transatlantic**
   ```
   Query: "Suche Business Class Flüge von Frankfurt nach New York am 15. März 2025"
   Expected: Award + Cash flights, Business cabin, FRA → JFK
   ```

2. **Award Flights**
   ```
   Query: "Zeige mir die günstigsten Award-Flüge von FRA nach JFK"
   Expected: Seats.aero results only, sorted by miles
   ```

3. **Round-Trip**
   ```
   Query: "Ich brauche einen Hin- und Rückflug von München nach Tokyo im Juni"
   Expected: Award + Cash flights, MUC → NRT/HND, return flight included
   ```

4. **Direct Flights**
   ```
   Query: "Gibt es Nonstop-Flüge von Berlin nach San Francisco?"
   Expected: Filtered results with maxStops=0, BER → SFO
   ```

5. **First Class Miles**
   ```
   Query: "Zeige mir First Class Optionen mit Miles & More"
   Expected: Award flights only, First cabin, LH preferred
   ```

### Error Handling Tests

1. **Invalid Dates**
   - Input: Past date (e.g., "2024-01-01")
   - Expected: Error message in German

2. **Invalid Airport Codes**
   - Input: Non-existent IATA code (e.g., "XXX")
   - Expected: Graceful error, suggestion to check codes

3. **Both APIs Fail**
   - Simulate: API keys removed/invalid
   - Expected: Appropriate error message, no crash

4. **One API Fails**
   - Simulate: Seats.aero fails, Amadeus succeeds
   - Expected: Show available results (Amadeus), note award search issue

### Performance Tests

1. **Response Time**
   - Target: <5 seconds for complete search
   - Measure: Time from tool execution to result return
   - Test with: Multiple searches, different routes

2. **Deduplication**
   - Execute same query twice in same chat
   - Expected: Second call uses cached result (dedupe key match)

3. **Token Cache Hit Rate**
   - Target: >90% cache hits after initial request
   - Monitor: Database queries for tokens
   - Test: 10 consecutive searches

4. **Session State Persistence**
   - Execute multiple searches in same chat
   - Expected: Session state updated after each search
   - Verify: lastFlightSearch field contains latest parameters

## Test Results Documentation

### Recording Test Outputs

After running tests, save outputs to:
```
tasks/backend/DD-MM-YYYY/phase-6-testing/verification.md
```

Include:
- Test execution timestamp
- Pass/fail counts
- Execution times
- Any errors or warnings
- Performance metrics

## Known Limitations

### Mocking Considerations
- Tests use mock functions for external dependencies
- Real API calls are not made in unit tests
- Integration tests mock database operations
- Manual testing required for end-to-end verification

### Database Testing
- Tool-call tests assume database connection available
- Use test database or mocked queries
- Clean up test data after execution

### API Rate Limits
- Seats.aero: Rate limits apply in production
- Amadeus: Test environment may have different limits
- Avoid running manual tests too frequently

## Troubleshooting

### Common Issues

#### 1. Tests Not Found
```bash
# Ensure tsx is available globally or use npx
npx tsx --test lib/api/seats-aero-client.test.ts
```

#### 2. Module Resolution Errors
```bash
# Check tsconfig.json paths configuration
# Ensure @/ alias points to correct directory
```

#### 3. Database Connection Errors
```bash
# Verify DATABASE_URL in .env.local
# Check Neon database is accessible
```

#### 4. API Key Errors
```bash
# Ensure test environment variables are set:
# - SEATSAERO_API_KEY
# - AMADEUS_CLIENT_ID
# - AMADEUS_CLIENT_SECRET
```

## Next Steps

After completing Phase 6 Testing:

1. **Address Test Failures** - Fix any failing tests before proceeding
2. **Performance Optimization** - If targets not met, optimize bottlenecks
3. **Phase 7: Deployment** - Deploy to staging with feature flag
4. **Monitor Production** - Set up error tracking and performance monitoring

## Related Documentation

- [Migration Plan](plan-v1-to-v2-tool-calling-migration.md) (if exists)
- [AGENTS.md](AGENTS.md) - Development workflow
- [Linear Issue MYLO-2](https://linear.app/stay-digital-pascal/issue/MYLO-2/phase-6-testing-and-verification)
