import assert from 'node:assert/strict';
import test from 'node:test';
import { executeVoiceToolCall } from './voice-tools';

test('executeVoiceToolCall handles the datetime tool locally', async () => {
  const result = (await executeVoiceToolCall({
    toolName: 'get_current_datetime',
    args: { timezone: 'Europe/Berlin' },
  })) as {
    timezone: string;
    iso: string;
    formatted: string;
  };

  assert.equal(result.timezone, 'Europe/Berlin');
  assert.ok(typeof result.iso === 'string');
  assert.ok(typeof result.formatted === 'string');
});

test('executeVoiceToolCall delegates to injected voice tool registry', async () => {
  const result = (await executeVoiceToolCall(
    {
      toolName: 'search_flights',
      args: { origin: 'FRA' },
      context: { userId: 'user_123', chatId: 'chat_123' },
    },
    {
      search_flights: async (args, context) => ({
        args,
        context,
      }),
    },
  )) as {
    args: Record<string, unknown>;
    context: { userId?: string; chatId?: string };
  };

  assert.deepEqual(result, {
    args: { origin: 'FRA' },
    context: { userId: 'user_123', chatId: 'chat_123' },
  });
});

test('executeVoiceToolCall rejects tools outside the voice core set', async () => {
  await assert.rejects(
    () =>
      executeVoiceToolCall({
        toolName: 'delete_user_account',
        args: {},
      }),
    /not available in voice mode/i,
  );
});
