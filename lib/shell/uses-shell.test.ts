import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usesShell } from './uses-shell';

test('shell and availability actions follow one binary admin rollout', async () => {
  const calls: string[] = [];
  const isAdmin = async (id: string) => { calls.push(id); return id === 'admin'; };
  assert.equal(await usesShell(null, isAdmin), false);
  assert.equal(await usesShell(undefined, isAdmin), false);
  assert.deepEqual(calls, []);
  assert.equal(await usesShell('admin', isAdmin), true);
  assert.equal(await usesShell('member', isAdmin), false);
});
