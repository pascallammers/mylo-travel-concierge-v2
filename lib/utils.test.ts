import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSearchGroups } from './utils';

const SCIRA_GROUPS = ['x', 'stocks', 'crypto', 'reddit', 'youtube', 'academic'];

test('getSearchGroups hides the Scira groups that have nothing to do with travel', () => {
  const visible = getSearchGroups()
    .filter((group) => group.show)
    .map((group) => group.id);

  for (const id of SCIRA_GROUPS) {
    assert.ok(!visible.includes(id as (typeof visible)[number]), `${id} must not be shown`);
  }
  assert.ok(visible.includes('web'));
});
