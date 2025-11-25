# AI Tools

## Overview

This project uses the Vercel AI SDK to create AI tools that extend the capabilities of LLM assistants. Tools allow the AI to perform actions like searching flights, fetching weather data, or querying databases.

## When to Apply

- Creating new AI-powered features
- Implementing search functionality
- Adding external API integrations
- Building interactive AI capabilities

## Core Principles

1. **Clear Descriptions** - Tool descriptions guide the AI on when to use them
2. **Strict Validation** - Use Zod schemas for all inputs
3. **Error Resilience** - Handle failures gracefully
4. **Non-Blocking Logging** - Don't let DB failures stop tool execution
5. **Formatted Output** - Return human-readable results for the AI

## ✅ DO

### DO: Write Detailed Tool Descriptions

```typescript
// lib/tools/flight-search.ts
import { tool } from 'ai';
import { z } from 'zod';

export const flightSearchTool = tool({
  description: `Search for flights between any two cities or airports worldwide.

This tool automatically:
- Searches BOTH award flights (bookable with miles/points) AND cash flights
- Converts city names to airport codes (e.g., "Frankfurt" → "FRA")
- Handles flexible date ranges and cabin class preferences

Call this tool immediately when the user asks about:
- Flight prices or availability between cities
- Business/First class travel or upgrades
- Award bookings with miles or points
- Comparing flight options

You do NOT need to know IATA airport codes - just pass city names.

Examples:
- "Flights from Frankfurt to Phuket in Business Class"
- "How many miles do I need to fly to Tokyo?"
- "Show me the cheapest flights to Bangkok"`,

  inputSchema: z.object({
    origin: z.string().min(3).describe('Origin city or airport'),
    destination: z.string().min(3).describe('Destination city or airport'),
    departDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('YYYY-MM-DD'),
    // ... more fields
  }),
  
  execute: async (params) => {
    // Implementation
  },
});
```

### DO: Validate Input Parameters

```typescript
execute: async (params) => {
  // Validate dates are not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const departDate = new Date(params.departDate);
  if (departDate < today) {
    throw new Error(
      `Departure date (${params.departDate}) is in the past. Please provide a future date.`
    );
  }
  
  if (params.returnDate) {
    const returnDate = new Date(params.returnDate);
    if (returnDate < departDate) {
      throw new Error('Return date cannot be before departure date.');
    }
  }
  
  // Resolve and validate airport codes
  const origin = resolveIATACode(params.origin);
  const destination = resolveIATACode(params.destination);
  
  if (!origin || !destination) {
    throw new Error(`Could not resolve airport codes for: ${params.origin} → ${params.destination}`);
  }
  
  // Proceed with valid params
}
```

### DO: Handle Failures Gracefully

```typescript
execute: async (params) => {
  // Non-blocking DB logging
  let toolCallId: string | null = null;
  try {
    const result = await recordToolCall({
      chatId,
      toolName: 'search_flights',
      request: params,
    });
    toolCallId = result.id;
  } catch (dbError) {
    console.warn('[Flight Search] ⚠️ DB logging failed (continuing):', dbError);
    // Continue execution - don't fail the tool
  }
  
  try {
    // Parallel API calls with individual error handling
    const [seatsResult, amadeusResult] = await Promise.all([
      searchSeatsAero(params).catch((err) => {
        console.error('[Seats.aero] Failed:', err.message);
        return null; // Don't fail entire tool
      }),
      searchAmadeus(params).catch((err) => {
        console.error('[Amadeus] Failed:', err.message);
        return null;
      }),
    ]);
    
    // Check if we have any results
    if (!seatsResult && !amadeusResult) {
      throw new Error('No flights found. Try different dates or routes.');
    }
    
    return formatResults({ seatsResult, amadeusResult });
  } catch (error) {
    // Update tool status on failure
    if (toolCallId) {
      await updateToolCall(toolCallId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => {}); // Don't throw on logging failure
    }
    throw error;
  }
}
```

### DO: Return Formatted Results for LLM

```typescript
function formatFlightResults(result: any, params: any): string {
  const sections: string[] = [];
  
  // Award Flights Section
  if (result.seats.count > 0) {
    sections.push(`## Flights with Miles/Points (${result.seats.count} results)\n`);
    
    result.seats.flights.forEach((flight: any, idx: number) => {
      sections.push(
        `### ${idx + 1}. ${flight.airline} - ${flight.cabin}\n` +
        `**Price:** ${flight.price}\n` +
        `**Departure:** ${flight.outbound.departure.airport} at ${flight.outbound.departure.time}\n` +
        `**Arrival:** ${flight.outbound.arrival.airport} at ${flight.outbound.arrival.time}\n` +
        `**Duration:** ${flight.outbound.duration}\n` +
        `**Stops:** ${flight.outbound.stops}\n\n`
      );
    });
  }
  
  // Cash Flights Section
  if (result.amadeus.count > 0) {
    sections.push(`## Cash Flights (${result.amadeus.count} results)\n`);
    
    result.amadeus.flights.forEach((flight: any, idx: number) => {
      const bookingUrl = buildGoogleFlightsUrl(params);
      sections.push(
        `### ${idx + 1}. ${flight.airline}\n` +
        `**Price:** ${flight.price.total} ${flight.price.currency}\n` +
        `**Book:** [Google Flights](${bookingUrl})\n\n`
      );
    });
  }
  
  // No results
  if (result.seats.count === 0 && result.amadeus.count === 0) {
    sections.push(
      `No flights found for your search.\n\n` +
      `**Search Parameters:**\n` +
      `- Route: ${params.origin} → ${params.destination}\n` +
      `- Date: ${params.departDate}\n` +
      `- Class: ${params.cabin}\n\n` +
      `Try:\n` +
      `- Different dates\n` +
      `- Alternative airports\n`
    );
  }
  
  return sections.join('\n');
}
```

### DO: Use Factory Functions for Parameterized Tools

```typescript
// lib/tools/web-search.ts
export const webSearchTool = (
  dataStream: any,
  searchProvider: 'parallel' | 'exa' | 'tavily' | 'firecrawl' | undefined
) => tool({
  description: 'Search the web for current information',
  inputSchema: z.object({
    queries: z.array(z.string()).min(1).max(5),
    maxResults: z.number().default(10),
  }),
  execute: async (params) => {
    // Use injected dataStream and searchProvider
    const results = await performSearch(params, searchProvider);
    dataStream.write({ type: 'search-results', data: results });
    return results;
  },
});

// lib/tools/greeting.ts
export const greetingTool = (timezone: string) => tool({
  description: 'Get a personalized greeting based on time of day',
  inputSchema: z.object({}),
  execute: async () => {
    const hour = new Date().toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    // Return appropriate greeting
  },
});
```

## ❌ DON'T

### DON'T: Write Vague Descriptions

```typescript
// ❌ Bad - vague description
export const searchTool = tool({
  description: 'Search for things',
  // ...
});

// ✅ Good - specific, actionable description
export const searchTool = tool({
  description: `Search academic papers and research publications.

Use when the user:
- Asks about scientific research
- Needs citations or references
- Wants to find papers on a topic

Returns: Title, authors, abstract, citation count, and link.`,
  // ...
});
```

### DON'T: Let DB Failures Stop Tool Execution

```typescript
// ❌ Bad - DB failure stops the tool
execute: async (params) => {
  await recordToolCall(toolData); // If this fails, tool fails
  const results = await searchAPI(params);
  return results;
}

// ✅ Good - graceful handling
execute: async (params) => {
  try {
    await recordToolCall(toolData);
  } catch (error) {
    console.warn('DB logging failed (continuing):', error);
  }
  const results = await searchAPI(params);
  return results;
}
```

### DON'T: Return Raw API Responses

```typescript
// ❌ Bad - raw JSON dump
execute: async (params) => {
  const response = await api.search(params);
  return response; // Hard for AI to interpret
}

// ✅ Good - formatted for LLM
execute: async (params) => {
  const response = await api.search(params);
  return formatForLLM(response); // Human-readable markdown
}
```

### DON'T: Skip Input Validation

```typescript
// ❌ Bad - no validation
execute: async (params) => {
  const results = await searchFlights(
    params.origin,
    params.destination,
    params.departDate // Could be invalid!
  );
}

// ✅ Good - validate first
execute: async (params) => {
  if (!isValidDate(params.departDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD.');
  }
  if (!isValidIATA(params.origin)) {
    throw new Error(`Unknown airport: ${params.origin}`);
  }
  // Now safe to proceed
}
```

## Tool Registry Pattern

```typescript
// app/api/search/route.ts
const createToolRegistry = (
  dataStream: any,
  searchProvider: SearchProvider,
  user: User | null,
  selectedConnectors: Connector[],
  timezone: string,
  activeTools: readonly string[]
) => {
  // All available tools
  const allTools: Record<string, any> = {
    stock_chart: stockChartTool,
    currency_converter: currencyConverterTool,
    web_search: webSearchTool(dataStream, searchProvider),
    search_flights: flightSearchTool,
    get_weather_data: weatherTool,
    datetime: datetimeTool,
    greeting: greetingTool(timezone),
    // ... more tools
  };
  
  // Filter to active tools only
  const filteredTools: Record<string, any> = {};
  for (const [toolName, toolImpl] of Object.entries(allTools)) {
    if (activeTools.includes(toolName)) {
      filteredTools[toolName] = toolImpl;
    }
  }
  
  // Add user-specific tools if authenticated
  if (user) {
    const memoryTools = createMemoryTools(user.id);
    if (activeTools.includes('search_memories')) {
      filteredTools.search_memories = memoryTools.searchMemories;
    }
    if (activeTools.includes('add_memory')) {
      filteredTools.add_memory = memoryTools.addMemory;
    }
  }
  
  console.log('🔧 Registered Tools:', Object.keys(filteredTools));
  return filteredTools;
};
```

## Tool Call Tracking Schema

```typescript
// lib/db/schema.ts
export const toolCallStatus = [
  'queued',
  'running', 
  'succeeded',
  'failed',
  'timeout',
  'canceled'
] as const;

export type ToolCallStatus = (typeof toolCallStatus)[number];

export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: text('chat_id').notNull().references(() => chat.id),
  toolName: text('tool_name').notNull(),
  status: text('status').$type<ToolCallStatus>().default('queued'),
  request: json('request'),
  response: json('response'),
  error: text('error'),
  dedupeKey: text('dedupe_key').unique(),
  createdAt: timestamp('created_at').defaultNow(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
});
```

## Testing Standards

```typescript
import { describe, it, expect, mock } from 'node:test';
import { flightSearchTool } from './flight-search';

describe('flightSearchTool', () => {
  it('should validate departure date is not in past', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    await expect(
      flightSearchTool.execute({
        origin: 'FRA',
        destination: 'BKK',
        departDate: yesterday.toISOString().split('T')[0],
        cabin: 'ECONOMY',
        passengers: 1,
      }, { messages: [], abortSignal: new AbortController().signal })
    ).rejects.toThrow('in the past');
  });
  
  it('should handle API failures gracefully', async () => {
    // Mock API to fail
    mock.method(api, 'search', () => Promise.reject(new Error('API down')));
    
    const result = await flightSearchTool.execute({
      origin: 'FRA',
      destination: 'BKK',
      departDate: '2025-12-01',
      cabin: 'ECONOMY',
      passengers: 1,
    }, { messages: [], abortSignal: new AbortController().signal });
    
    expect(result).toContain('No flights found');
  });
});
```

## Resources

- [Vercel AI SDK Tools](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [Tool Call Streaming](https://sdk.vercel.ai/docs/ai-sdk-ui/streaming-data)
- [lib/tools/](/lib/tools/) - Project tool implementations
