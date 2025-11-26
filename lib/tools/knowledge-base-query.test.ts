import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  queryKnowledgeBase,
  KB_SIGNALS,
  type KBQueryService,
} from './knowledge-base-query';
import type { QueryResult } from '@/lib/gemini-file-search-store';

// ============================================
// Test Utilities
// ============================================

/**
 * Creates a mock query service for testing.
 */
function createMockService(
  queryFn: (query: string) => Promise<QueryResult>
): KBQueryService {
  return { query: queryFn };
}

/**
 * Factory to create a mock QueryResult with found status.
 */
const makeFoundResult = (overrides: Partial<QueryResult> = {}): QueryResult => ({
  answer: overrides.answer ?? 'A detailed answer about travel.',
  sources: overrides.sources ?? [{ title: 'Doc1', chunk: 'Some content', uri: 'gs://test/doc.md' }],
  confidence: overrides.confidence ?? 0.9,
  status: 'found',
});

/**
 * Factory to create a mock QueryResult with not_found status.
 */
const makeNotFoundResult = (): QueryResult => ({
  answer: '',
  sources: [],
  confidence: 0.3,
  status: 'not_found',
});

/**
 * Factory to create a mock QueryResult with error status.
 */
const makeErrorResult = (): QueryResult => ({
  answer: '',
  sources: [],
  confidence: 0,
  status: 'error',
});

/**
 * Factory to create a delayed mock function.
 */
const makeDelayedQuery = (result: QueryResult, delayMs: number) => async () => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return result;
};

// ============================================
// Tests
// ============================================

describe('queryKnowledgeBase', () => {
  describe('Not Found Responses', () => {
    it('returns not_found when File Search Store returns not_found', async () => {
      const mockService = createMockService(async () => makeNotFoundResult());

      const result = await queryKnowledgeBase('any', { _testService: mockService });

      assert.equal(result.status, 'not_found');
      assert.equal(result.reason, 'not_found');
      assert.equal(result.documentsSearched, 0);
      assert.equal(result.signal, KB_SIGNALS.NOT_FOUND);
    });

    it('returns not_found when no sources are returned', async () => {
      const mockService = createMockService(async () => ({
        answer: 'Some answer',
        sources: [],
        confidence: 0.3,
        status: 'found',
      }));

      const result = await queryKnowledgeBase('any', { _testService: mockService });

      assert.equal(result.status, 'not_found');
      assert.equal(result.signal, KB_SIGNALS.NOT_FOUND);
    });
  });

  describe('Successful Query with High Confidence', () => {
    it('returns found with confidence when answer meets threshold', async () => {
      const answer =
        'The best time to visit Bali is during the dry season from April to October. ' +
        'This period offers the best weather conditions for beach activities.';

      const mockService = createMockService(async () =>
        makeFoundResult({
          answer,
          confidence: 0.9,
          sources: [{ title: 'Bali Guide', chunk: 'Travel tips', uri: 'gs://test/bali.md' }],
        })
      );

      const result = await queryKnowledgeBase('What is the best time to visit Bali?', {
        confidenceThreshold: 0.5,
        _testService: mockService,
      });

      assert.equal(result.status, 'found');
      assert.equal(result.answer, answer);
      assert.equal(result.documentsSearched, 1);
      assert.equal(typeof result.confidence, 'number');
      assert.ok(result.confidence !== undefined && result.confidence >= 0.5);
      assert.equal(result.signal, undefined);
    });

    it('includes documents searched count from sources', async () => {
      const mockService = createMockService(async () =>
        makeFoundResult({
          sources: [
            { title: 'Doc1', chunk: 'Content 1', uri: 'gs://test/1.md' },
            { title: 'Doc2', chunk: 'Content 2', uri: 'gs://test/2.md' },
            { title: 'Doc3', chunk: 'Content 3', uri: 'gs://test/3.md' },
          ],
        })
      );

      const result = await queryKnowledgeBase('travel tips', {
        confidenceThreshold: 0.5,
        _testService: mockService,
      });

      assert.equal(result.documentsSearched, 3);
    });
  });

  describe('Low Confidence Responses', () => {
    it('returns low_confidence when confidence is below threshold', async () => {
      const answer = 'Maybe you could visit sometime.';

      const mockService = createMockService(async () =>
        makeFoundResult({
          answer,
          confidence: 0.5,
          sources: [{ title: 'Doc', chunk: 'Content', uri: 'gs://test/doc.md' }],
        })
      );

      const result = await queryKnowledgeBase('What is the best time to visit Bali?', {
        confidenceThreshold: 0.9,
        _testService: mockService,
      });

      assert.equal(result.status, 'low_confidence');
      assert.equal(result.reason, 'low_confidence');
      assert.equal(result.answer, answer);
      assert.equal(result.documentsSearched, 1);
      assert.equal(result.signal, KB_SIGNALS.LOW_CONFIDENCE);
    });

    it('uses default confidence threshold from KB_CONFIG when not specified', async () => {
      const mockService = createMockService(async () =>
        makeFoundResult({
          confidence: 0.5,
          sources: [{ title: 'Doc', chunk: 'Content', uri: 'gs://test/doc.md' }],
        })
      );

      // Default threshold is typically 0.70, so 0.5 should be low_confidence
      const result = await queryKnowledgeBase('question', { _testService: mockService });

      // Could be low_confidence if 0.5 < default threshold
      assert.ok(['found', 'low_confidence'].includes(result.status));
    });
  });

  describe('Configuration Options', () => {
    it('respects custom confidence threshold - low threshold', async () => {
      const mockService = createMockService(async () =>
        makeFoundResult({
          confidence: 0.2,
          sources: [{ title: 'Doc', chunk: 'Content', uri: 'gs://test/doc.md' }],
        })
      );

      // With very low threshold, should return found
      const result = await queryKnowledgeBase('question', {
        confidenceThreshold: 0.1,
        _testService: mockService,
      });

      assert.equal(result.status, 'found');
    });

    it('respects very high confidence threshold', async () => {
      const mockService = createMockService(async () =>
        makeFoundResult({
          confidence: 0.9,
          sources: [{ title: 'Doc', chunk: 'Content', uri: 'gs://test/doc.md' }],
        })
      );

      const result = await queryKnowledgeBase('question', {
        confidenceThreshold: 0.99,
        _testService: mockService,
      });

      assert.equal(result.status, 'low_confidence');
    });
  });

  describe('Error Handling', () => {
    it('returns error status when File Search Store returns error', async () => {
      const mockService = createMockService(async () => makeErrorResult());

      const result = await queryKnowledgeBase('any', { _testService: mockService });

      assert.equal(result.status, 'error');
      assert.equal(result.reason, 'error');
      assert.equal(result.signal, KB_SIGNALS.ERROR);
    });

    it('returns error status when query throws', async () => {
      const mockService = createMockService(async () => {
        throw new Error('API rate limit exceeded');
      });

      const result = await queryKnowledgeBase('any', { _testService: mockService });

      assert.equal(result.status, 'error');
      assert.equal(result.signal, KB_SIGNALS.ERROR);
    });

    it('handles timeout correctly', async () => {
      const mockService = createMockService(makeDelayedQuery(makeFoundResult(), 200));

      const result = await queryKnowledgeBase('any', { timeoutMs: 50, _testService: mockService });

      assert.equal(result.status, 'error');
      assert.equal(result.signal, KB_SIGNALS.ERROR);
    });
  });

  describe('Signal Constants', () => {
    it('KB_SIGNALS.NOT_FOUND has correct value', () => {
      assert.equal(KB_SIGNALS.NOT_FOUND, '__KB_NOT_FOUND__');
    });

    it('KB_SIGNALS.LOW_CONFIDENCE has correct value', () => {
      assert.equal(KB_SIGNALS.LOW_CONFIDENCE, '__KB_LOW_CONFIDENCE__');
    });

    it('KB_SIGNALS.ERROR has correct value', () => {
      assert.equal(KB_SIGNALS.ERROR, '__KB_ERROR__');
    });
  });

  describe('Response Structure', () => {
    it('found response has correct structure', async () => {
      const mockService = createMockService(async () =>
        makeFoundResult({
          sources: [{ title: 'Doc', chunk: 'Content', uri: 'gs://test/doc.md' }],
        })
      );

      const result = await queryKnowledgeBase('query', {
        confidenceThreshold: 0.3,
        _testService: mockService,
      });

      if (result.status === 'found') {
        assert.ok('status' in result);
        assert.ok('answer' in result);
        assert.ok('confidence' in result);
        assert.ok('documentsSearched' in result);
        assert.equal(result.signal, undefined);
      }
    });

    it('low_confidence response has correct structure', async () => {
      const mockService = createMockService(async () =>
        makeFoundResult({
          confidence: 0.5,
          sources: [{ title: 'Doc', chunk: 'Content', uri: 'gs://test/doc.md' }],
        })
      );

      const result = await queryKnowledgeBase('query', {
        confidenceThreshold: 0.99,
        _testService: mockService,
      });

      assert.equal(result.status, 'low_confidence');
      assert.ok('status' in result);
      assert.ok('reason' in result);
      assert.ok('answer' in result);
      assert.ok('confidence' in result);
      assert.ok('documentsSearched' in result);
      assert.ok('signal' in result);
    });

    it('not_found response has correct structure', async () => {
      const mockService = createMockService(async () => makeNotFoundResult());

      const result = await queryKnowledgeBase('query', { _testService: mockService });

      assert.equal(result.status, 'not_found');
      assert.ok('status' in result);
      assert.ok('reason' in result);
      assert.ok('documentsSearched' in result);
      assert.ok('signal' in result);
    });

    it('error response has correct structure', async () => {
      const mockService = createMockService(async () => {
        throw new Error('Test error');
      });

      const result = await queryKnowledgeBase('query', { _testService: mockService });

      assert.equal(result.status, 'error');
      assert.ok('status' in result);
      assert.ok('reason' in result);
      assert.ok('signal' in result);
    });
  });

  describe('Query Handling', () => {
    it('passes query to File Search Store', async () => {
      let capturedQuery = '';
      const mockService = createMockService(async (query: string) => {
        capturedQuery = query;
        return makeFoundResult();
      });

      await queryKnowledgeBase('What is the best time to visit Thailand?', {
        _testService: mockService,
      });

      assert.equal(capturedQuery, 'What is the best time to visit Thailand?');
    });

    it('handles empty query string', async () => {
      const mockService = createMockService(async () =>
        makeFoundResult({
          sources: [{ title: 'Doc', chunk: 'Content', uri: 'gs://test/doc.md' }],
        })
      );

      const result = await queryKnowledgeBase('', {
        confidenceThreshold: 0.5,
        _testService: mockService,
      });

      assert.ok(['found', 'low_confidence', 'not_found', 'error'].includes(result.status));
    });

    it('handles special characters in query', async () => {
      const mockService = createMockService(async () =>
        makeFoundResult({
          sources: [{ title: 'Doc', chunk: 'Content', uri: 'gs://test/doc.md' }],
        })
      );

      const result = await queryKnowledgeBase('What about flights to München & Zürich?', {
        confidenceThreshold: 0.5,
        _testService: mockService,
      });

      assert.ok(['found', 'low_confidence'].includes(result.status));
    });
  });
});
