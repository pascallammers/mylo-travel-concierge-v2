import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  isFlightIntent,
  extractTextFromMessage,
  FLIGHT_TOOL_NAMES,
} from './flight-intent-detector';

describe('isFlightIntent — positive cases', () => {
  it('detects English route with date', () => {
    assert.strictEqual(
      isFlightIntent('Find flights from Frankfurt to JFK on June 15'),
      true,
    );
  });

  it('detects German route phrasing', () => {
    assert.strictEqual(isFlightIntent('Flüge von Berlin nach Tokyo'), true);
  });

  it('detects miles-to-destination question', () => {
    assert.strictEqual(isFlightIntent('How many miles to Bangkok?'), true);
  });

  it('detects "cheapest flight to X"', () => {
    assert.strictEqual(isFlightIntent('cheapest flight to Phuket'), true);
  });

  it('detects bare "Flug" with route', () => {
    assert.strictEqual(
      isFlightIntent('Ich brauche einen Flug nach Bali im Mai'),
      true,
    );
  });

  it('detects "airfare" keyword', () => {
    assert.strictEqual(
      isFlightIntent('What is the airfare from LAX to NRT next month?'),
      true,
    );
  });

  it('detects German Meilen with destination', () => {
    // "How many miles to Tokyo" — equivalent to the English spec example.
    // Intent is to search for award availability, not factual loyalty knowledge.
    assert.strictEqual(
      isFlightIntent('Wie viele Meilen brauche ich nach Tokyo?'),
      true,
    );
  });

  it('detects "fliegen" + route corroboration', () => {
    assert.strictEqual(
      isFlightIntent('Wir wollen von München nach NYC fliegen'),
      true,
    );
  });
});

describe('isFlightIntent — negative cases', () => {
  it('rejects factual cabin-class question (German)', () => {
    assert.strictEqual(
      isFlightIntent(
        'Was ist der Unterschied zwischen Business und First Class?',
      ),
      false,
    );
  });

  it('rejects factual airline alliance question', () => {
    assert.strictEqual(
      isFlightIntent('Lufthansa Star Alliance question — how does it work?'),
      false,
    );
  });

  it('rejects hotel query', () => {
    assert.strictEqual(isFlightIntent('Hotel in Paris'), false);
  });

  it('rejects weather query', () => {
    assert.strictEqual(isFlightIntent('Wetter in Tokyo'), false);
  });

  it('rejects figurative "time flies"', () => {
    assert.strictEqual(isFlightIntent('Wow, time flies when you travel'), false);
  });

  it('rejects empty / whitespace input', () => {
    assert.strictEqual(isFlightIntent(''), false);
    assert.strictEqual(isFlightIntent('   '), false);
    assert.strictEqual(isFlightIntent(null), false);
    assert.strictEqual(isFlightIntent(undefined), false);
  });

  it('rejects pure points-program factual question', () => {
    assert.strictEqual(
      isFlightIntent('What is the difference between Avios and miles?'),
      false,
    );
  });

  it('rejects "fly under the radar" idiom', () => {
    assert.strictEqual(
      isFlightIntent('I want to fly under the radar with this launch'),
      false,
    );
  });
});

describe('isFlightIntent — edge cases', () => {
  it('accepts strong token + IATA codes', () => {
    assert.strictEqual(isFlightIntent('Flight FRA to JFK'), true);
  });

  it('rejects factual "Was ist ein Codeshare-Flug?"', () => {
    assert.strictEqual(isFlightIntent('Was ist ein Codeshare-Flug?'), false);
  });

  it('case-insensitive English keyword', () => {
    assert.strictEqual(
      isFlightIntent('FLIGHTS to bangkok please'),
      true,
    );
  });

  it('does not false-positive on "Hotel near Frankfurt airport"', () => {
    assert.strictEqual(
      isFlightIntent('Hotel near Frankfurt airport'),
      false,
    );
  });
});

describe('FLIGHT_TOOL_NAMES', () => {
  it('contains the three expected tool names', () => {
    assert.deepStrictEqual([...FLIGHT_TOOL_NAMES].sort(), [
      'kiwi_flight_search',
      'search_flights',
      'skiplagged_flight_search',
    ]);
  });
});

describe('extractTextFromMessage', () => {
  it('returns "" for nullish / non-object input', () => {
    assert.strictEqual(extractTextFromMessage(null), '');
    assert.strictEqual(extractTextFromMessage(undefined), '');
    assert.strictEqual(extractTextFromMessage(42), '');
  });

  it('extracts string content (ModelMessage)', () => {
    assert.strictEqual(
      extractTextFromMessage({ role: 'user', content: 'Hello world' }),
      'Hello world',
    );
  });

  it('extracts text parts from UIMessage shape', () => {
    const msg = {
      role: 'user',
      parts: [
        { type: 'text', text: 'Find flights' },
        { type: 'text', text: 'to Bali' },
      ],
    };
    assert.strictEqual(extractTextFromMessage(msg), 'Find flights to Bali');
  });

  it('extracts text parts from ModelMessage array content', () => {
    const msg = {
      role: 'user',
      content: [
        { type: 'text', text: 'Flüge nach' },
        { type: 'image', image: 'data:...' },
        { type: 'text', text: 'Tokyo' },
      ],
    };
    assert.strictEqual(extractTextFromMessage(msg), 'Flüge nach Tokyo');
  });

  it('returns "" when message has no text content', () => {
    assert.strictEqual(
      extractTextFromMessage({ role: 'user', parts: [] }),
      '',
    );
  });
});
