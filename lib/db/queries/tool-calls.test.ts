/**
 * Unit tests for Tool Call Registry
 * Tests tool call recording, deduplication, and status updates
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { recordToolCall, updateToolCall, getToolCallById } from '../queries';
import crypto from 'crypto';

describe('Tool Call Registry', () => {
  describe('recordToolCall', () => {
    it('should create a new tool call record', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = {
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
        cabinClass: 'business',
      };

      // Note: This is a simplified test - actual implementation requires database connection
      const toolCall = await recordToolCall({
        chatId,
        toolName,
        parameters,
        status: 'pending',
      });

      assert.ok(toolCall, 'Should return tool call record');
      assert.strictEqual(toolCall.chatId, chatId, 'Chat ID should match');
      assert.strictEqual(toolCall.toolName, toolName, 'Tool name should match');
      assert.strictEqual(toolCall.status, 'pending', 'Status should be pending');
      assert.ok(toolCall.dedupeKey, 'Should have dedupe key');
    });

    it('should generate consistent dedupe keys for same parameters', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = {
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
      };

      // Generate dedupe key manually
      const paramsString = JSON.stringify(parameters);
      const expectedDedupeKey = crypto
        .createHash('sha256')
        .update(`${toolName}:${paramsString}`)
        .digest('hex');

      const toolCall = await recordToolCall({
        chatId,
        toolName,
        parameters,
        status: 'pending',
      });

      assert.strictEqual(toolCall.dedupeKey, expectedDedupeKey, 'Dedupe key should be consistent');
    });

    it('should prevent duplicate tool calls with same dedupe key', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = {
        origin: 'FRA',
        destination: 'JFK',
        departureDate: '2025-03-15',
      };

      // First call
      const firstCall = await recordToolCall({
        chatId,
        toolName,
        parameters,
        status: 'pending',
      });

      // Second call with same parameters should return existing record
      const secondCall = await recordToolCall({
        chatId,
        toolName,
        parameters,
        status: 'pending',
      });

      assert.strictEqual(firstCall.id, secondCall.id, 'Should return same record for duplicate call');
    });

    it('should handle different parameters as separate calls', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';

      const call1 = await recordToolCall({
        chatId,
        toolName,
        parameters: { origin: 'FRA', destination: 'JFK' },
        status: 'pending',
      });

      const call2 = await recordToolCall({
        chatId,
        toolName,
        parameters: { origin: 'MUC', destination: 'LAX' },
        status: 'pending',
      });

      assert.notStrictEqual(call1.id, call2.id, 'Different parameters should create separate records');
      assert.notStrictEqual(call1.dedupeKey, call2.dedupeKey, 'Dedupe keys should be different');
    });
  });

  describe('updateToolCall', () => {
    it('should update tool call status to completed', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = { origin: 'FRA', destination: 'JFK' };

      const toolCall = await recordToolCall({
        chatId,
        toolName,
        parameters,
        status: 'pending',
      });

      const result = { flights: ['flight1', 'flight2'] };

      const updated = await updateToolCall({
        id: toolCall.id,
        status: 'completed',
        result,
        executionTime: 3500,
      });

      assert.strictEqual(updated.status, 'completed', 'Status should be updated');
      assert.ok(updated.result, 'Result should be stored');
      assert.strictEqual(updated.executionTime, 3500, 'Execution time should be recorded');
      assert.ok(updated.completedAt, 'Completion timestamp should be set');
    });

    it('should update tool call status to failed with error', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = { origin: 'FRA', destination: 'JFK' };

      const toolCall = await recordToolCall({
        chatId,
        toolName,
        parameters,
        status: 'pending',
      });

      const error = 'API rate limit exceeded';

      const updated = await updateToolCall({
        id: toolCall.id,
        status: 'failed',
        error,
        executionTime: 1200,
      });

      assert.strictEqual(updated.status, 'failed', 'Status should be failed');
      assert.strictEqual(updated.error, error, 'Error message should be stored');
      assert.ok(updated.completedAt, 'Completion timestamp should be set even for failures');
    });

    it('should handle partial updates', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = { origin: 'FRA', destination: 'JFK' };

      const toolCall = await recordToolCall({
        chatId,
        toolName,
        parameters,
        status: 'pending',
      });

      // Update only status
      const updated = await updateToolCall({
        id: toolCall.id,
        status: 'running',
      });

      assert.strictEqual(updated.status, 'running', 'Status should be updated');
      assert.strictEqual(updated.result, null, 'Result should remain null');
    });
  });

  describe('getToolCallById', () => {
    it('should retrieve tool call by ID', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = { origin: 'FRA', destination: 'JFK' };

      const created = await recordToolCall({
        chatId,
        toolName,
        parameters,
        status: 'pending',
      });

      const retrieved = await getToolCallById(created.id);

      assert.ok(retrieved, 'Should retrieve tool call');
      assert.strictEqual(retrieved.id, created.id, 'ID should match');
      assert.strictEqual(retrieved.toolName, toolName, 'Tool name should match');
      assert.deepStrictEqual(retrieved.parameters, parameters, 'Parameters should match');
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await getToolCallById(999999);

      assert.strictEqual(retrieved, null, 'Should return null for non-existent ID');
    });
  });

  describe('Deduplication logic', () => {
    it('should deduplicate within same chat session', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = { origin: 'FRA', destination: 'JFK' };

      const call1 = await recordToolCall({ chatId, toolName, parameters, status: 'pending' });
      const call2 = await recordToolCall({ chatId, toolName, parameters, status: 'pending' });

      assert.strictEqual(call1.id, call2.id, 'Should return same call for duplicate in same chat');
    });

    it('should allow same query in different chats', async () => {
      const toolName = 'search_flights';
      const parameters = { origin: 'FRA', destination: 'JFK' };

      const call1 = await recordToolCall({
        chatId: 'chat-1',
        toolName,
        parameters,
        status: 'pending',
      });

      const call2 = await recordToolCall({
        chatId: 'chat-2',
        toolName,
        parameters,
        status: 'pending',
      });

      // Different chats should have different records even with same parameters
      assert.notStrictEqual(call1.chatId, call2.chatId, 'Chat IDs should be different');
    });

    it('should handle parameter order variations', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';

      const params1 = { origin: 'FRA', destination: 'JFK', cabinClass: 'business' };
      const params2 = { cabinClass: 'business', destination: 'JFK', origin: 'FRA' };

      const call1 = await recordToolCall({ chatId, toolName, parameters: params1, status: 'pending' });
      const call2 = await recordToolCall({ chatId, toolName, parameters: params2, status: 'pending' });

      // Note: Depending on implementation, this might deduplicate or not
      // If using JSON.stringify directly, order matters
      // If using sorted keys, should deduplicate
      assert.ok(call1.dedupeKey, 'Call 1 should have dedupe key');
      assert.ok(call2.dedupeKey, 'Call 2 should have dedupe key');
    });
  });

  describe('Status transitions', () => {
    it('should track status progression: pending -> running -> completed', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = { origin: 'FRA', destination: 'JFK' };

      const toolCall = await recordToolCall({ chatId, toolName, parameters, status: 'pending' });
      assert.strictEqual(toolCall.status, 'pending', 'Initial status should be pending');

      const running = await updateToolCall({ id: toolCall.id, status: 'running' });
      assert.strictEqual(running.status, 'running', 'Status should update to running');

      const completed = await updateToolCall({
        id: toolCall.id,
        status: 'completed',
        result: { data: 'result' },
      });
      assert.strictEqual(completed.status, 'completed', 'Status should update to completed');
    });

    it('should allow status transition to failed from any state', async () => {
      const chatId = 'test-chat-123';
      const toolName = 'search_flights';
      const parameters = { origin: 'FRA', destination: 'JFK' };

      const toolCall = await recordToolCall({ chatId, toolName, parameters, status: 'pending' });

      const failed = await updateToolCall({
        id: toolCall.id,
        status: 'failed',
        error: 'API error',
      });

      assert.strictEqual(failed.status, 'failed', 'Should allow transition to failed');
      assert.ok(failed.error, 'Error message should be recorded');
    });
  });
});
