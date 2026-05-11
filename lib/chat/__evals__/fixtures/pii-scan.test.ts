// lib/chat/__evals__/fixtures/pii-scan.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { scanForPii } from '../anonymize';
import { realChats } from './real-chats';

describe('real-chats PII guard', () => {
  const SCANNED_FIELDS = ['userQuery', 'description', 'reason'] as const;

  for (const fx of realChats) {
    for (const field of SCANNED_FIELDS) {
      it(`fixture ${fx.id} field "${field}" contains no PII patterns`, () => {
        const value = fx[field];
        const issues = scanForPii(value);
        assert.deepStrictEqual(
          issues,
          [],
          `${fx.id}.${field} contains PII: ${issues.join(', ')} → "${value}"`,
        );
      });
    }
  }

  it('has the expected count of fixtures', () => {
    assert.ok(
      realChats.length === 0 || realChats.length === 5,
      'real-chats.ts should be empty (pre-extraction) or have exactly 5 fixtures',
    );
  });
});
