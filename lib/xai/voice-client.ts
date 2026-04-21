const AUDIO_DELTA_EVENT_TYPES = new Set(['response.output_audio.delta', 'response.audio.delta']);
const AUDIO_TRANSCRIPT_EVENT_TYPES = new Set([
  'response.output_audio_transcript.delta',
  'response.audio_transcript.delta',
]);

/**
 * Detects realtime assistant audio delta events across current and legacy xAI payloads.
 *
 * @param eventType - Raw realtime event type from the xAI websocket.
 * @returns Whether the event carries assistant audio PCM data.
 */
export function isVoiceResponseAudioDeltaEvent(eventType: string): boolean {
  return AUDIO_DELTA_EVENT_TYPES.has(eventType);
}

/**
 * Detects realtime assistant transcript delta events across current and legacy xAI payloads.
 *
 * @param eventType - Raw realtime event type from the xAI websocket.
 * @returns Whether the event carries assistant transcript text.
 */
export function isVoiceResponseTranscriptDeltaEvent(eventType: string): boolean {
  return AUDIO_TRANSCRIPT_EVENT_TYPES.has(eventType);
}

/**
 * Combines the non-empty recorder chunks into one transcribable audio blob.
 *
 * @param chunks - Recorder chunks collected during the browser capture lifecycle.
 * @param mimeType - Preferred output mime type for the final blob.
 * @returns A final blob ready for upload, or null when no audio was captured.
 */
export function createRecordedAudioBlob(chunks: Blob[], mimeType?: string): Blob | null {
  const nonEmptyChunks = chunks.filter((chunk) => chunk.size > 0);

  if (nonEmptyChunks.length === 0) {
    return null;
  }

  return new Blob(nonEmptyChunks, {
    type: mimeType || nonEmptyChunks[0]?.type || 'audio/webm',
  });
}

function writeAsciiString(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

/**
 * Encodes decoded browser audio into a standard PCM WAV blob.
 *
 * @param audioBuffer - Decoded browser audio buffer.
 * @returns A WAV blob with a RIFF/WAVE header and PCM16 samples.
 */
export function encodeAudioBufferAsWav(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataSize = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const channels = Array.from({ length: numberOfChannels }, (_, channelIndex) =>
    audioBuffer.getChannelData(channelIndex),
  );

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, 'WAVE');
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;

  for (let sampleIndex = 0; sampleIndex < audioBuffer.length; sampleIndex += 1) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[sampleIndex] ?? 0));
      const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, pcmSample, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Converts browser recorder output into WAV before sending it to xAI STT.
 *
 * @param audioBlob - Browser-recorded audio blob from MediaRecorder.
 * @returns A WAV blob accepted by the xAI speech-to-text endpoint.
 */
export async function convertRecordedAudioToWav(audioBlob: Blob): Promise<Blob> {
  const AudioContextConstructor =
    globalThis.AudioContext ??
    (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('AudioContext is not available for audio conversion.');
  }

  const audioContext = new AudioContextConstructor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());
    return encodeAudioBufferAsWav(audioBuffer);
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

/**
 * Derives a stable file extension for the recorded audio upload.
 *
 * @param mimeType - Browser-provided audio mime type.
 * @returns The file extension expected by the server-side STT endpoint.
 */
export function getRecordedAudioExtension(mimeType: string): string {
  const normalizedMimeType = mimeType.toLowerCase();

  if (normalizedMimeType.includes('wav')) return 'wav';
  if (normalizedMimeType.includes('mp4') || normalizedMimeType.includes('m4a')) return 'mp4';
  if (normalizedMimeType.includes('ogg') || normalizedMimeType.includes('opus')) return 'ogg';
  if (normalizedMimeType.includes('mpeg') || normalizedMimeType.includes('mp3')) return 'mp3';

  return 'webm';
}
