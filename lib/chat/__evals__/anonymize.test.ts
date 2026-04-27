// lib/chat/__evals__/anonymize.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { anonymizeUserQuery, scanForPii } from './anonymize';

describe('anonymizeUserQuery', () => {
  it('replaces emails with placeholder', () => {
    const out = anonymizeUserQuery('Buch mir was an pascal@example.com');
    assert.strictEqual(out, 'Buch mir was an user@example.com');
  });

  it('replaces emails with umlaut local-part', () => {
    const out = anonymizeUserQuery('Schreib an müller@beispiel.de');
    assert.strictEqual(out, 'Schreib an user@example.com');
  });

  it('replaces E.164 international phone numbers', () => {
    const out = anonymizeUserQuery('Ruf mich an unter +49 171 1234567');
    assert.match(out, /\+49 xxx xxx xxxx/);
  });

  it('replaces German national-format phone numbers', () => {
    const out = anonymizeUserQuery('Erreichst du mich unter 0171 1234567?');
    assert.match(out, /0xxx xxxxxxx/);
    assert.doesNotMatch(out, /1234567/);
  });

  it('replaces 8+ digit numbers (loyalty IDs)', () => {
    const out = anonymizeUserQuery('Mein Vielflieger ist 992812345');
    assert.match(out, /XXXXXXXX/);
    assert.doesNotMatch(out, /992812345/);
  });

  it('keeps short numeric content like dates and prices', () => {
    const out = anonymizeUserQuery('Flug am 15.03.2026 für 450 EUR');
    assert.strictEqual(out, 'Flug am 15.03.2026 für 450 EUR');
  });

  it('replaces a known user first name when provided (case-insensitive)', () => {
    const out = anonymizeUserQuery('Hallo, hier ist Pascal', { userName: 'Pascal' });
    assert.match(out, /\[Name\]/);
    assert.doesNotMatch(out, /Pascal/);
  });

  it('replaces lowercase variant of userName', () => {
    const out = anonymizeUserQuery('hier ist pascal', { userName: 'Pascal' });
    assert.match(out, /\[Name\]/);
    assert.doesNotMatch(out, /pascal/i);
  });

  it('does NOT corrupt substrings that contain the userName', () => {
    const out = anonymizeUserQuery('Tim fliegt nach Timbuktu', { userName: 'Tim' });
    assert.strictEqual(out, '[Name] fliegt nach Timbuktu');
  });

  it('does NOT corrupt names with adjacent non-ASCII letters (Anaïs vs Ana)', () => {
    // \b treats ï as non-word in JS regex, so a naive \bAna\b would
    // incorrectly replace the "Ana" prefix of "Anaïs". Unicode-safe lookarounds
    // using \p{L}\p{N}_ prevent that.
    const out = anonymizeUserQuery('Hallo Anaïs!', { userName: 'Ana' });
    assert.strictEqual(out, 'Hallo Anaïs!');
  });

  it('replaces userName containing umlauts at word boundaries', () => {
    const out = anonymizeUserQuery('Ich heiße Müller', { userName: 'Müller' });
    assert.strictEqual(out, 'Ich heiße [Name]');
  });

  it('does NOT corrupt umlaut-containing names embedded in longer words', () => {
    // "Müllerhausen" contains "Müller" but is a different word.
    const out = anonymizeUserQuery('Wir wohnen in Müllerhausen', { userName: 'Müller' });
    assert.strictEqual(out, 'Wir wohnen in Müllerhausen');
  });
});

describe('scanForPii', () => {
  it('flags emails', () => {
    assert.deepStrictEqual(
      scanForPii('contact me at user@example.com'),
      ['email-pattern'],
    );
  });

  it('flags international phones', () => {
    assert.deepStrictEqual(scanForPii('+49 171 1234567'), ['phone-pattern']);
  });

  it('flags German national-format phones', () => {
    assert.deepStrictEqual(scanForPii('0171 1234567'), ['phone-pattern']);
  });

  it('flags long digit runs', () => {
    assert.deepStrictEqual(scanForPii('id 123456789'), ['long-digit-run']);
  });

  it('returns empty for clean text', () => {
    assert.deepStrictEqual(scanForPii('Flüge nach Bangkok'), []);
  });

  it('is idempotent across repeat calls (lastIndex reset works)', () => {
    const text = 'user@example.com';
    const first = scanForPii(text);
    const second = scanForPii(text);
    assert.deepStrictEqual(first, second);
    assert.deepStrictEqual(first, ['email-pattern']);
  });
});
