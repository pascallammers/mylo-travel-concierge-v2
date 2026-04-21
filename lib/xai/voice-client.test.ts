import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRecordedAudioBlob,
  encodeAudioBufferAsWav,
  isVoiceResponseAudioDeltaEvent,
  isVoiceResponseTranscriptDeltaEvent,
} from './voice-client';

test('createRecordedAudioBlob keeps the final non-empty recorder chunk', async () => {
  const blob = createRecordedAudioBlob(
    [new Blob([], { type: 'audio/webm' }), new Blob(['final-audio'], { type: 'audio/webm' })],
    'audio/webm',
  );

  assert.ok(blob);
  assert.equal(blob?.type, 'audio/webm');
  assert.equal(await blob?.text(), 'final-audio');
});

test('createRecordedAudioBlob returns null when every recorder chunk is empty', () => {
  const blob = createRecordedAudioBlob([new Blob([], { type: 'audio/webm' })], 'audio/webm');

  assert.equal(blob, null);
});

test('encodeAudioBufferAsWav creates a PCM WAV blob for transcription upload', async () => {
  const samples = new Float32Array([0, 0.5, -0.5]);
  const audioBuffer = {
    numberOfChannels: 1,
    sampleRate: 16000,
    length: samples.length,
    getChannelData: () => samples,
  } as unknown as AudioBuffer;

  const blob = encodeAudioBufferAsWav(audioBuffer);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const header = String.fromCharCode(...bytes.slice(0, 12));

  assert.equal(blob.type, 'audio/wav');
  assert.equal(header.slice(0, 4), 'RIFF');
  assert.equal(header.slice(8, 12), 'WAVE');
  assert.equal(bytes.length, 44 + samples.length * 2);
});

test('isVoiceResponseAudioDeltaEvent supports the current xAI output audio event name', () => {
  assert.equal(isVoiceResponseAudioDeltaEvent('response.output_audio.delta'), true);
  assert.equal(isVoiceResponseAudioDeltaEvent('response.audio.delta'), true);
  assert.equal(isVoiceResponseAudioDeltaEvent('response.done'), false);
});

test('isVoiceResponseTranscriptDeltaEvent supports the current xAI transcript event name', () => {
  assert.equal(isVoiceResponseTranscriptDeltaEvent('response.output_audio_transcript.delta'), true);
  assert.equal(isVoiceResponseTranscriptDeltaEvent('response.audio_transcript.delta'), true);
  assert.equal(isVoiceResponseTranscriptDeltaEvent('response.output_audio.done'), false);
});
