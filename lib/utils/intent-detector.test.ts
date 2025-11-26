import { describe, test, expect } from 'bun:test';
import { detectIntent, type QueryIntent, type IntentResult } from './intent-detector';

describe('detectIntent', () => {
  describe('TRANSACTIONAL queries (should skip KB)', () => {
    test('detects German flight booking with date', () => {
      const result = detectIntent('Buche mir einen Flug nach Bangkok am 15.12');

      expect(result.intent).toBe('transactional');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.signals).toContain('transactional:booking_request');
      expect(result.signals).toContain('transactional:date_pattern');
    });

    test('detects English flight booking with date', () => {
      const result = detectIntent('Book a flight to New York on 20.01');

      expect(result.intent).toBe('transactional');
      expect(result.signals).toContain('transactional:booking_request');
      expect(result.signals).toContain('transactional:date_pattern');
    });

    test('detects price query with route (German)', () => {
      // Single pattern match returns ambiguous per spec (needs >= 2 for transactional)
      const result = detectIntent('Was kostet ein Flug von Frankfurt nach Tokyo?');

      expect(result.signals).toContain('transactional:price_with_route');
      // With only 1 transactional signal, expect ambiguous
      expect(result.intent).toBe('ambiguous');
    });

    test('detects price query with route (English)', () => {
      // Single pattern match returns ambiguous per spec
      const result = detectIntent('What is the price from London to Paris?');

      expect(result.signals).toContain('transactional:price_with_route');
      expect(result.intent).toBe('ambiguous');
    });

    test('detects flight search request (German)', () => {
      // Single pattern match returns ambiguous per spec
      const result = detectIntent('Suche Flüge von Berlin nach Mallorca');

      expect(result.signals).toContain('transactional:flight_search_request');
      expect(result.intent).toBe('ambiguous');
    });

    test('detects flight search request (English)', () => {
      // Single pattern match returns ambiguous per spec
      const result = detectIntent('Show me flights from NYC to LAX');

      expect(result.signals).toContain('transactional:flight_search_request');
      expect(result.intent).toBe('ambiguous');
    });

    test('detects reservation request (German)', () => {
      const result = detectIntent('Reserviere mir einen Platz auf dem Flug am 10.05');

      expect(result.intent).toBe('transactional');
      expect(result.signals).toContain('transactional:booking_request');
    });

    test('detects flight with date pattern (dot separator)', () => {
      const result = detectIntent('Fliegen nach Bali am 25.12');

      expect(result.intent).toBe('transactional');
      expect(result.signals).toContain('transactional:date_pattern');
    });

    test('detects flight with date pattern (slash separator)', () => {
      const result = detectIntent('Flight to Tokyo for 12/25');

      expect(result.intent).toBe('transactional');
      expect(result.signals).toContain('transactional:date_pattern');
    });

    test('detects cost query with route', () => {
      // Single pattern match returns ambiguous per spec
      const result = detectIntent('How much does it cost from Berlin to Bangkok?');

      expect(result.signals).toContain('transactional:price_with_route');
      expect(result.intent).toBe('ambiguous');
    });
  });

  describe('INFORMATIONAL queries (should use KB)', () => {
    test('detects tips request (German)', () => {
      const result = detectIntent('Hast du Tipps für eine Reise nach Thailand?');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:tips_advice');
    });

    test('detects tips request (English)', () => {
      const result = detectIntent('Do you have any travel tips for Japan?');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:tips_advice');
    });

    test('detects best time question (German)', () => {
      const result = detectIntent('Wann ist die beste Zeit um nach Bali zu reisen?');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:best_time_question');
    });

    test('detects best time question (English)', () => {
      const result = detectIntent('What is the best time to visit Thailand?');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:best_time_question');
    });

    test('detects destination info request (German)', () => {
      const result = detectIntent('Was muss ich über Vietnam wissen?');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:destination_info');
    });

    test('detects destination info request (English)', () => {
      const result = detectIntent('What should I know about traveling to India?');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:destination_info');
    });

    test('detects how-to question (German)', () => {
      const result = detectIntent('Wie bereite ich mich auf eine lange Flugreise vor?');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:how_to_question');
    });

    test('detects how-to question (English)', () => {
      const result = detectIntent('How do I prepare for a trip to Southeast Asia?');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:how_to_question');
    });

    test('detects recommendation request', () => {
      const result = detectIntent('Can you recommend a destination for winter?');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:tips_advice');
    });

    test('detects advice request (German)', () => {
      const result = detectIntent('Ich brauche Rat für meine erste Asienreise');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:tips_advice');
    });

    test('detects "about" destination query', () => {
      const result = detectIntent('Tell me about Bali');

      expect(result.intent).toBe('informational');
      expect(result.signals).toContain('informational:destination_info');
    });
  });

  describe('AMBIGUOUS and edge cases', () => {
    test('returns informational for queries with no pattern matches', () => {
      const result = detectIntent('Hello');

      expect(result.intent).toBe('informational');
      expect(result.confidence).toBe(0);
      expect(result.signals).toHaveLength(0);
    });

    test('returns informational for generic travel questions', () => {
      const result = detectIntent('Bali ist schön');

      expect(result.intent).toBe('informational');
      expect(result.signals).toHaveLength(0);
    });

    test('handles mixed signals with transactional dominance', () => {
      // This query has booking + date (2 transactional) vs tips (1 informational)
      const result = detectIntent('Buche mir einen Flug mit Tipps am 15.12');

      expect(result.intent).toBe('transactional');
      expect(result.signals).toContain('transactional:booking_request');
      expect(result.signals).toContain('transactional:date_pattern');
      expect(result.signals).toContain('informational:tips_advice');
    });

    test('handles equal scores as ambiguous when transactional < 2', () => {
      // This query has 1 transactional (booking) and 1 informational (tips)
      const result = detectIntent('Buche mir etwas mit Tipps');

      // With equal scores and transactional < 2, it should be ambiguous
      expect(result.intent).toBe('ambiguous');
      expect(result.confidence).toBe(0.5);
    });

    test('handles empty query', () => {
      const result = detectIntent('');

      expect(result.intent).toBe('informational');
      expect(result.confidence).toBe(0);
      expect(result.signals).toHaveLength(0);
    });
  });

  describe('confidence calculation', () => {
    test('returns confidence 1 when all signals are transactional', () => {
      // Query with 2+ transactional signals and no informational signals
      const result = detectIntent('Buche mir einen Flug am 15.12');

      expect(result.intent).toBe('transactional');
      expect(result.confidence).toBe(1);
      expect(result.signals.length).toBeGreaterThanOrEqual(2);
    });

    test('returns confidence 1 when all signals are informational', () => {
      const result = detectIntent('What is the best time to visit? Any tips?');

      expect(result.intent).toBe('informational');
      expect(result.confidence).toBe(1);
    });

    test('returns partial confidence for mixed signals', () => {
      const result = detectIntent('Buche mir einen Flug mit Tipps am 15.12');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(1);
    });
  });

  describe('bilingual support', () => {
    test('handles German umlaut in Flug', () => {
      const result = detectIntent('Zeig mir Flüge von München nach Rom');

      expect(result.intent).toBe('transactional');
      expect(result.signals).toContain('transactional:flight_search_request');
    });

    test('handles case insensitivity', () => {
      const result1 = detectIntent('BUCHE EINEN FLUG');
      const result2 = detectIntent('buche einen flug');

      expect(result1.signals).toContain('transactional:booking_request');
      expect(result2.signals).toContain('transactional:booking_request');
    });

    test('handles mixed language query', () => {
      const result = detectIntent('Book a Flug nach Bangkok');

      expect(result.signals.some((s) => s.includes('booking_request'))).toBe(true);
    });
  });

  describe('return type structure', () => {
    test('returns correct IntentResult structure', () => {
      const result = detectIntent('Any travel tips?');

      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('signals');
      expect(typeof result.intent).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(Array.isArray(result.signals)).toBe(true);
    });

    test('intent is one of the allowed values', () => {
      const allowedIntents: QueryIntent[] = ['transactional', 'informational', 'ambiguous'];

      const result1 = detectIntent('Book a flight');
      const result2 = detectIntent('Travel tips');
      const result3 = detectIntent('Something neutral');

      expect(allowedIntents).toContain(result1.intent);
      expect(allowedIntents).toContain(result2.intent);
      expect(allowedIntents).toContain(result3.intent);
    });

    test('confidence is between 0 and 1', () => {
      const queries = [
        'Book a flight on 15.12',
        'Travel tips for Japan',
        'Hello',
        '',
      ];

      for (const query of queries) {
        const result = detectIntent(query);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});
