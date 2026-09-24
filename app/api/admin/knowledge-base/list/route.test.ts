import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

process.env.SKIP_ENV_VALIDATION = '1';
const require = createRequire(import.meta.url);
let session: { id: string } | null = { id: 'user' };
let role = 'admin';
const calls: string[] = [];
function spy(name: string, result: unknown) {
  return async () => {
    calls.push(name);
    return result;
  };
}
mock.module('@/lib/auth-utils', {
  namedExports: {
    getUser: async () => session,
    getUserRole: async (id: string) => {
      assert.equal(id, session?.id);
      return role;
    },
  },
});
mock.module('@/lib/db/queries/kb-documents', {
  namedExports: {
    listKBDocuments: spy('list', { documents: [], total: 0, hasMore: false }),
    createKBDocument: spy('create', { id: 'document' }),
    getKBDocumentById: spy('get', {
      id: 'document',
      geminiFileName: 'files/document',
      fileSearchDocumentName: 'stores/document',
    }),
    bulkSoftDeleteKBDocuments: spy('delete', 1),
  },
});
mock.module('@/lib/gemini-file-manager', {
  namedExports: {
    GeminiFileManager: {
      uploadFile: spy('uploadFile', { name: 'files/document', uri: 'gs://document' }),
      deleteFile: spy('deleteFile', undefined),
    },
  },
});
mock.module('@/lib/gemini-file-search-store', {
  namedExports: {
    geminiFileSearchStore: {
      uploadFile: spy('uploadStore', { storeName: 'store', documentName: 'stores/document' }),
      deleteDocument: spy('deleteDocument', undefined),
    },
  },
});
mock.module('fs/promises', {
  namedExports: { writeFile: spy('writeFile', undefined), unlink: spy('unlink', undefined) },
});
const route: typeof import('./route') = require('./route.ts');
beforeEach(() => {
  session = { id: 'user' };
  role = 'admin';
  calls.length = 0;
});
function request() {
  return new NextRequest('http://localhost/api/admin/knowledge-base/list');
}
for (const state of ['no session', 'non-admin', 'admin'] as const) {
  test('GET list: ' + state, async () => {
    if (state === 'no session') session = null;
    if (state === 'non-admin') role = 'user';
    const response = await route.GET(request());
    assert.equal(response.status, state === 'no session' ? 401 : state === 'non-admin' ? 403 : 200);
    assert.deepEqual(calls, state === 'admin' ? ['list'] : []);
  });
}
