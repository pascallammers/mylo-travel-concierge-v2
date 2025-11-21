import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { GeminiFile } from '@/lib/gemini-file-manager';
import { queryKnowledgeBase } from './knowledge-base-query';

const makeFile = (overrides: Partial<GeminiFile>): GeminiFile => ({
  name: overrides.name ?? 'files/123',
  displayName: overrides.displayName ?? 'doc.md',
  mimeType: overrides.mimeType ?? 'text/plain',
  sizeBytes: overrides.sizeBytes ?? '1024',
  createTime: overrides.createTime ?? new Date().toISOString(),
  updateTime: overrides.updateTime ?? new Date().toISOString(),
  expirationTime: overrides.expirationTime ?? new Date(Date.now() + 86400000).toISOString(),
  uri: overrides.uri ?? 'gs://kb/doc.md',
  state: overrides.state ?? 'ACTIVE',
});

const makeModel = (responseText: string) => ({
  generateContent: async () => ({
    response: Promise.resolve({
      text: () => responseText,
    }),
  }),
});

describe('queryKnowledgeBase', () => {
  it('returns empty when no files exist', async () => {
    const result = await queryKnowledgeBase('any', {
      listFiles: async () => [],
      model: makeModel('NOT_USED'),
    });

    assert.deepEqual(result, { status: 'empty', reason: 'no_files' });
  });

  it('returns empty when no active files are present', async () => {
    const result = await queryKnowledgeBase('any', {
      listFiles: async () => [makeFile({ state: 'PROCESSING' })],
      model: makeModel('NOT_USED'),
    });

    assert.deepEqual(result, { status: 'empty', reason: 'no_active_files' });
  });

  it('returns not_found when Gemini responds with NOT_FOUND token (case-insensitive)', async () => {
    const result = await queryKnowledgeBase('any', {
      listFiles: async () => [makeFile({})],
      model: makeModel('not_found in files'),
    });

    assert.deepEqual(result, { status: 'not_found', reason: 'not_found' });
  });

  it('returns found with the answer text when content is present', async () => {
    const answer = 'Here is the KB answer.';
    const result = await queryKnowledgeBase('question', {
      listFiles: async () => [makeFile({})],
      model: makeModel(answer),
    });

    assert.deepEqual(result, { status: 'found', answer });
  });
});
