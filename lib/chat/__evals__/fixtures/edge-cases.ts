// lib/chat/__evals__/fixtures/edge-cases.ts
import type { EvalFixture } from './types';

const FIXED_NOW = new Date('2026-04-27T10:00:00.000Z');

export const edgeCases: EvalFixture[] = [
  {
    id: 'edge-001-past-date-refusal',
    source: 'edge',
    description: 'Past-date flight query → LLM refuses pre-call, politely informs user (per system prompt)',
    userQuery: 'Flüge von Frankfurt nach Phuket am 15.03.2024 in Business',
    expectedTool: null,
    reason:
      'System prompt at lib/chat/mylo-system-prompt.ts:79-86 explicitly says: BEFORE calling search_flights, check if dates are in the past. If past, politely inform the user WITHOUT calling the tool. This fixture validates the pre-call date guard. The `now` field below makes 2024-03-15 unambiguously past.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-002-kb-general-travel',
    source: 'edge',
    description: 'General informational travel query → KB-First mandate',
    userQuery: 'Wann ist beste Reisezeit für Bali?',
    expectedTool: 'knowledge_base',
    reason:
      'KB-First applies to ANY informational/factual query without explicit booking intent. Bali timing is a general travel question.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-003-award-explicit-de',
    source: 'edge',
    description: 'DACH-German award/miles query MUST route to search_flights',
    userQuery: 'Wie viele Meilen brauche ich für Frankfurt-Tokyo Business?',
    expectedTool: 'search_flights',
    reason:
      'System prompt lists "Meilen", "Award", and route patterns as flight triggers. This must NOT fall back to web_search.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-004-loyalty-specific',
    source: 'edge',
    description: 'Provider-specific loyalty query → tool, not system context',
    userQuery: 'Wie viele Lufthansa-Meilen habe ich?',
    expectedTool: 'get_loyalty_balances',
    reason:
      'System prompt: specific provider details require the tool, system context only covers aggregates.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-005-datetime-tz',
    source: 'edge',
    description: 'Timezone query for travel destination → datetime tool',
    userQuery: 'Wie spät ist es gerade in Bangkok?',
    expectedTool: 'datetime',
    reason:
      'System prompt: datetime tool handles time/timezone queries directly. KB-First does NOT apply when a domain-specific tool exists. Replaces the previous loyalty-aggregate fixture which was not testable without injected user context.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-006-weather',
    source: 'edge',
    description: 'Direct weather query → weather tool, not KB or web',
    userQuery: 'Wie ist das Wetter in Bangkok?',
    expectedTool: 'get_weather_data',
    reason:
      'Weather has its own tool. KB-First does NOT apply when a domain-specific tool exists.',
    now: FIXED_NOW,
  },
  {
    id: 'edge-007-mixed-language',
    source: 'edge',
    description: 'English location-near query → nearby_places_search, not web_search',
    userQuery: 'Show me hotels near Phuket Old Town',
    expectedTool: 'nearby_places_search',
    reason:
      'System prompt: "near <location>" triggers nearby_places_search. Language-mixing must not break routing.',
    now: FIXED_NOW,
  },
];
