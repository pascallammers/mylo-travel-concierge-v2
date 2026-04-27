import assert from 'node:assert';
import { describe, it } from 'node:test';
import { anonymizeUserQuery, scanForPii } from './anonymize';

describe('anonymizeUserQuery', () => {
  it('replaces emails with placeholder', () => {
    const out = anonymizeUserQuery('Buch mir was an pascal@example.com');
    assert.strictEqual(out, 'Buch mir was an user@example.com');
  });

  it('replaces E.164 phone numbers', () => {
    const out = anonymizeUserQuery('Ruf mich an unter +49 171 1234567');
    assert.match(out, /\+49 xxx xxx xxxx/);
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

  it('replaces a known user first name when provided', () => {
    const out = anonymizeUserQuery('Hallo, hier ist Pascal', { userName: 'Pascal' });
    assert.match(out, /\[Name\]/);
    assert.doesNotMatch(out, /Pascal/);
  });
});

describe('scanForPii', () => {
  it('flags emails', () => {
    assert.deepStrictEqual(
      scanForPii('contact me at user@example.com'),
      ['email-pattern'],
    );
  });

  it('flags long digit runs', () => {
    assert.deepStrictEqual(scanForPii('id 123456789'), ['long-digit-run']);
  });

  it('returns empty for clean text', () => {
    assert.deepStrictEqual(scanForPii('Flüge nach Bangkok'), []);
  });
});
