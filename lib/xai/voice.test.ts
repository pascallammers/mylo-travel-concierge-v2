import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVoiceCoreTools,
  buildXaiRealtimeSessionConfig,
  createXaiRealtimeClientSecret,
  generateXaiSpeech,
  transcribeAudioWithFallback,
  transcribeXaiAudio,
  XAI_REALTIME_WS_URL,
} from './voice';

test('buildVoiceCoreTools exposes the approved voice core set', () => {
  const tools = buildVoiceCoreTools();

  assert.ok(tools.some((tool) => tool.type === 'web_search'));
  assert.ok(tools.some((tool) => tool.type === 'function' && tool.name === 'get_current_datetime'));
  assert.ok(tools.some((tool) => tool.type === 'function' && tool.name === 'get_weather_data'));
  assert.ok(tools.some((tool) => tool.type === 'function' && tool.name === 'track_flight'));
  assert.ok(tools.some((tool) => tool.type === 'function' && tool.name === 'search_flights'));
  assert.ok(tools.some((tool) => tool.type === 'function' && tool.name === 'get_loyalty_balances'));
});

test('buildXaiRealtimeSessionConfig uses xAI realtime defaults for Mylo voice', () => {
  const session = buildXaiRealtimeSessionConfig({ instructions: 'Be concise.' });

  assert.equal(session.voice, 'eve');
  assert.equal(session.input_audio_format, 'pcm16');
  assert.equal(session.output_audio_format, 'pcm16');
  assert.deepEqual(session.modalities, ['text', 'audio']);
  assert.deepEqual(session.turn_detection, { type: 'server_vad' });
  assert.equal(session.tool_choice, 'auto');
  assert.equal(session.instructions, 'Be concise.');
  assert.ok(session.tools.length >= 5);
});

test('createXaiRealtimeClientSecret requests an ephemeral secret and returns browser metadata', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        value: 'secret_123',
        expires_at: '2026-04-19T12:34:56.000Z',
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  };

  const secret = await createXaiRealtimeClientSecret({
    apiKey: 'xai_test_key',
    fetch: fetchMock,
    expiresAfterSeconds: 180,
  });

  assert.equal(secret.value, 'secret_123');
  assert.equal(secret.expiresAt, '2026-04-19T12:34:56.000Z');
  assert.equal(secret.webSocketUrl, XAI_REALTIME_WS_URL);
  assert.equal(secret.protocol, 'xai-client-secret.secret_123');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://api.x.ai/v1/realtime/client_secrets');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, 'Bearer xai_test_key');
  assert.equal((calls[0]?.init?.headers as Record<string, string>)['Content-Type'], 'application/json');
  assert.equal(calls[0]?.init?.body, JSON.stringify({ expires_after: { seconds: 180 } }));
});

test('transcribeXaiAudio sends multipart audio to xAI STT', async () => {
  const audio = new Blob(['hello'], { type: 'audio/webm' });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ text: 'Hallo Welt' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const text = await transcribeXaiAudio({
    audio,
    apiKey: 'xai_test_key',
    fetch: fetchMock,
    filename: 'recording.webm',
    mediaType: 'audio/webm',
  });

  assert.equal(text, 'Hallo Welt');
  assert.equal(calls[0]?.url, 'https://api.x.ai/v1/stt');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, 'Bearer xai_test_key');
  assert.ok(calls[0]?.init?.body instanceof FormData);
});

test('transcribeAudioWithFallback uses fallback when xAI STT fails', async () => {
  const audio = new Blob(['hello'], { type: 'audio/webm' });
  const fetchMock: typeof fetch = async () =>
    new Response('EngineCore encountered an issue', {
      status: 500,
    });

  const text = await transcribeAudioWithFallback({
    audio,
    apiKey: 'xai_test_key',
    fetch: fetchMock,
    filename: 'recording.webm',
    mediaType: 'audio/webm',
    fallbackTranscribe: async (fallbackOptions) => {
      assert.equal(fallbackOptions.filename, 'recording.webm');
      assert.equal(fallbackOptions.mediaType, 'audio/webm');
      return 'Fallback transcript';
    },
  });

  assert.equal(text, 'Fallback transcript');
});

test('generateXaiSpeech returns a data url from xAI TTS audio bytes', async () => {
  const fetchMock: typeof fetch = async () =>
    new Response(Uint8Array.from([1, 2, 3, 4]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    });

  const dataUrl = await generateXaiSpeech({
    text: 'Hallo aus Mylo',
    apiKey: 'xai_test_key',
    fetch: fetchMock,
  });

  assert.match(dataUrl, /^data:audio\/mpeg;base64,/);
});
