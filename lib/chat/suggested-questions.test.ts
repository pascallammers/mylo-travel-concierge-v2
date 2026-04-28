import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildSuggestedQuestionsPrompt, parseSuggestedQuestionsText } from './suggested-questions';

describe('buildSuggestedQuestionsPrompt', () => {
  it('returns null for empty history', () => {
    assert.strictEqual(buildSuggestedQuestionsPrompt([]), null);
  });

  it('returns null when the assistant response is empty', () => {
    assert.strictEqual(
      buildSuggestedQuestionsPrompt([
        { role: 'user', content: 'Find flights from Frankfurt to JFK on June 15 2026' },
        { role: 'assistant', content: '' },
      ]),
      null,
    );
  });

  it('uses the latest user and assistant content', () => {
    const prompt = buildSuggestedQuestionsPrompt([
      { role: 'user', content: 'Old question' },
      { role: 'assistant', content: 'Old answer' },
      { role: 'user', content: 'Find flights from Frankfurt to JFK on June 15 2026' },
      { role: 'assistant', content: 'Singapore Airlines costs USD 414.76 nonstop.' },
    ]);

    assert.ok(prompt?.includes('Find flights from Frankfurt to JFK on June 15 2026'));
    assert.ok(prompt?.includes('Singapore Airlines costs USD 414.76 nonstop.'));
    assert.ok(!prompt?.includes('Old question'));
  });
});

describe('parseSuggestedQuestionsText', () => {
  it('parses exactly three plain-text questions', () => {
    assert.deepStrictEqual(
      parseSuggestedQuestionsText(
        [
          '1. Welche nonstop Flüge ab Frankfurt sind am günstigsten?',
          '2. Welche Award-Optionen lohnen sich mit Amex Punkten?',
          '3. Welche Rückflugtermine nach Frankfurt sind günstiger?',
        ].join('\n'),
      ),
      [
        'Welche nonstop Flüge ab Frankfurt sind am günstigsten?',
        'Welche Award-Optionen lohnen sich mit Amex Punkten?',
        'Welche Rückflugtermine nach Frankfurt sind günstiger?',
      ],
    );
  });

  it('drops tool-call shaped output from unsupported structured generation', () => {
    assert.deepStrictEqual(
      parseSuggestedQuestionsText(
        [
          'Assistant: <function_call name="web_search">',
          '<argument name="query">Stand der Kanyerunde in der Türkei 2025</argument>',
          '</function_call>',
        ].join('\n'),
      ),
      [],
    );
  });

  it('deduplicates and limits questions', () => {
    assert.deepStrictEqual(
      parseSuggestedQuestionsText(
        [
          '- Welche Airlines fliegen nonstop von Frankfurt nach JFK?',
          '- Welche Airlines fliegen nonstop von Frankfurt nach JFK?',
          '- Welche Meilenprogramme buchen diese Route günstiger?',
          '- Welche versteckten Gabelflug-Optionen sparen Geld?',
          '- Welche Hotels passen zu diesem Flug?',
        ].join('\n'),
      ),
      [
        'Welche Airlines fliegen nonstop von Frankfurt nach JFK?',
        'Welche Meilenprogramme buchen diese Route günstiger?',
        'Welche versteckten Gabelflug-Optionen sparen Geld?',
      ],
    );
  });
});
