// lib/chat/__evals__/fixtures/pii-scan.test.ts
import assert from 'node:assert';
import { describe, it } from 'node:test';
import { scanForPii } from '../anonymize';
import { realChats } from './real-chats';

describe('real-chats PII guard', () => {
  for (const fx of realChats) {
    it(`fixture ${fx.id} contains no PII patterns`, () => {
      const issues = scanForPii(fx.userQuery);
      assert.deepStrictEqual(
        issues,
        [],
        `${fx.id} userQuery contains PII: ${issues.join(', ')} → "${fx.userQuery}"`,
      );
    });
  }

  it('has the expected count of fixtures', () => {
    assert.ok(
      realChats.length === 0 || realChats.length === 5,
      'real-chats.ts should be empty (pre-extraction) or have exactly 5 fixtures',
    );
  });
});
