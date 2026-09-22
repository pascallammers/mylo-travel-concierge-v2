import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getInteractiveDatabase } from './interactive-client';

test('interactive database is lazy, rejects missing configuration and shares one pool', () => {
  const previous = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    assert.throws(getInteractiveDatabase, /Die Datenbank ist nicht konfiguriert\./);
    process.env.DATABASE_URL = 'postgres://localhost:1/unused';
    assert.equal(getInteractiveDatabase(), getInteractiveDatabase());
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
