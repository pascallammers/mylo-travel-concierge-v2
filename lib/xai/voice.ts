import { openai } from '@ai-sdk/openai';
import { experimental_transcribe as transcribe } from 'ai';

const XAI_API_BASE_URL = 'https://api.x.ai/v1';
export const XAI_REALTIME_WS_URL = 'wss://api.x.ai/v1/realtime';

export type XaiBuiltinVoiceTool = {
  type: 'web_search';
};

export type XaiFunctionVoiceTool = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type XaiVoiceTool = XaiBuiltinVoiceTool | XaiFunctionVoiceTool;

export type XaiRealtimeSessionConfig = {
  modalities: Array<'text' | 'audio'>;
  instructions: string;
  voice: string;
  input_audio_format: 'pcm16';
  output_audio_format: 'pcm16';
  turn_detection: {
    type: 'server_vad';
  };
  temperature: number;
  tool_choice: 'auto';
  tools: XaiVoiceTool[];
};

type FetchLike = typeof fetch;

type CreateXaiRealtimeClientSecretOptions = {
  apiKey?: string;
  fetch?: FetchLike;
  expiresAfterSeconds?: number;
  baseUrl?: string;
};

type TranscribeXaiAudioOptions = {
  audio: Blob;
  apiKey?: string;
  fetch?: FetchLike;
  filename?: string;
  mediaType?: string;
  baseUrl?: string;
};

type TranscribeAudioWithFallbackOptions = TranscribeXaiAudioOptions & {
  fallbackTranscribe?: (options: {
    audio: Blob;
    filename: string;
    mediaType: string;
  }) => Promise<string>;
};

type GenerateXaiSpeechOptions = {
  text: string;
  apiKey?: string;
  fetch?: FetchLike;
  voiceId?: string;
  language?: string;
  baseUrl?: string;
};

const DEFAULT_REALTIME_INSTRUCTIONS = [
  'You are MYLO, a travel concierge for premium travel planning.',
  'Respond naturally in the same language as the user, usually German or English.',
  'Keep spoken answers concise, helpful, and conversational.',
  'Use the available voice tools when they materially improve the answer.',
  'If a request needs a UI-heavy workflow or unsupported tool, say so clearly and ask the user to continue in text chat.',
].join(' ');

/**
 * Returns the runtime xAI API key or throws a clear configuration error.
 *
 * @param apiKey - Optional explicit API key override.
 * @returns The API key used for the xAI request.
 */
export function getXaiApiKey(apiKey?: string): string {
  const resolvedApiKey = apiKey ?? process.env.XAI_API_KEY;

  if (!resolvedApiKey) {
    throw new Error('Missing XAI_API_KEY for xAI voice requests.');
  }

  return resolvedApiKey;
}

/**
 * Returns the fixed tool set allowed inside the realtime voice mode.
 *
 * @returns The approved voice-core tools for xAI realtime sessions.
 */
export function buildVoiceCoreTools(): XaiVoiceTool[] {
  return [
    { type: 'web_search' },
    {
      type: 'function',
      name: 'get_current_datetime',
      description: 'Get the current date and time for simple scheduling and timezone questions.',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Optional IANA timezone like Europe/Berlin.',
          },
        },
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_weather_data',
      description: 'Get the current weather and forecast context for a place.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City, airport, or place name.',
          },
          latitude: {
            type: 'number',
            description: 'Optional latitude when coordinates are known.',
          },
          longitude: {
            type: 'number',
            description: 'Optional longitude when coordinates are known.',
          },
        },
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'track_flight',
      description: 'Track a flight status with airline code, flight number, and departure date.',
      parameters: {
        type: 'object',
        properties: {
          carrierCode: {
            type: 'string',
            description: 'Two-letter airline code, for example LH.',
          },
          flightNumber: {
            type: 'string',
            description: 'Flight number without airline code.',
          },
          scheduledDepartureDate: {
            type: 'string',
            description: 'Departure date in YYYY-MM-DD format.',
          },
        },
        required: ['carrierCode', 'flightNumber', 'scheduledDepartureDate'],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'search_flights',
      description: 'Search flights for premium travel planning, including cash and award options.',
      parameters: {
        type: 'object',
        properties: {
          origin: {
            type: 'string',
            description: 'Origin city or airport.',
          },
          destination: {
            type: 'string',
            description: 'Destination city or airport.',
          },
          departDate: {
            type: 'string',
            description: 'Departure date in YYYY-MM-DD format.',
          },
          returnDate: {
            type: 'string',
            description: 'Optional return date in YYYY-MM-DD format.',
          },
          cabin: {
            type: 'string',
            enum: ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'],
          },
          passengers: {
            type: 'number',
            minimum: 1,
            maximum: 9,
          },
          awardOnly: {
            type: 'boolean',
          },
          loyaltyPrograms: {
            type: 'array',
            items: { type: 'string' },
          },
          flexibility: {
            type: 'number',
            minimum: 0,
            maximum: 3,
          },
          nonStop: {
            type: 'boolean',
          },
          maxTaxes: {
            type: 'number',
          },
        },
        required: ['origin', 'destination', 'departDate', 'cabin'],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_loyalty_balances',
      description: 'Retrieve the user’s linked loyalty balances for airline or hotel programs.',
      parameters: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            description: 'Optional loyalty provider filter, for example Lufthansa or Marriott.',
          },
          includeDetails: {
            type: 'boolean',
            description: 'Whether detailed account information should be returned.',
          },
        },
        additionalProperties: false,
      },
    },
  ];
}

/**
 * Builds the xAI realtime session payload used for the dedicated voice mode.
 *
 * @param options - Optional instruction overrides.
 * @returns The session configuration sent to the xAI realtime socket.
 */
export function buildXaiRealtimeSessionConfig(options?: {
  instructions?: string;
  voice?: string;
}): XaiRealtimeSessionConfig {
  return {
    modalities: ['text', 'audio'],
    instructions: options?.instructions ?? DEFAULT_REALTIME_INSTRUCTIONS,
    voice: options?.voice ?? 'eve',
    input_audio_format: 'pcm16',
    output_audio_format: 'pcm16',
    turn_detection: {
      type: 'server_vad',
    },
    temperature: 0.8,
    tool_choice: 'auto',
    tools: buildVoiceCoreTools(),
  };
}

/**
 * Creates an ephemeral xAI realtime secret for browser use.
 *
 * @param options - Request options and test overrides.
 * @returns Browser-safe secret metadata for the realtime socket.
 */
export async function createXaiRealtimeClientSecret(
  options?: CreateXaiRealtimeClientSecretOptions,
): Promise<{
  value: string;
  expiresAt: string;
  webSocketUrl: string;
  protocol: string;
}> {
  const fetchImpl = options?.fetch ?? fetch;
  const response = await fetchImpl(`${options?.baseUrl ?? XAI_API_BASE_URL}/realtime/client_secrets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getXaiApiKey(options?.apiKey)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expires_after: {
        seconds: options?.expiresAfterSeconds ?? 300,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`xAI realtime secret request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as {
    value?: string;
    expires_at?: string;
  };

  if (!payload.value || !payload.expires_at) {
    throw new Error('xAI realtime secret response did not include value and expires_at.');
  }

  return {
    value: payload.value,
    expiresAt: payload.expires_at,
    webSocketUrl: XAI_REALTIME_WS_URL,
    protocol: `xai-client-secret.${payload.value}`,
  };
}

/**
 * Sends an uploaded audio blob to xAI speech-to-text.
 *
 * @param options - Audio payload and optional request overrides.
 * @returns The transcript text from xAI STT.
 */
export async function transcribeXaiAudio(options: TranscribeXaiAudioOptions): Promise<string> {
  const formData = new FormData();
  const file = new File([options.audio], options.filename ?? 'recording.webm', {
    type: options.mediaType ?? options.audio.type ?? 'audio/webm',
  });
  formData.append('file', file);

  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`${options.baseUrl ?? XAI_API_BASE_URL}/stt`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getXaiApiKey(options.apiKey)}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`xAI transcription failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as { text?: string };

  if (!payload.text) {
    throw new Error('xAI transcription response did not include text.');
  }

  return payload.text;
}

async function transcribeWithOpenAI(options: {
  audio: Blob;
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY for transcription fallback.');
  }

  const result = await transcribe({
    model: openai.transcription('whisper-1'),
    audio: await options.audio.arrayBuffer(),
  });

  return result.text;
}

/**
 * Transcribes audio with xAI first and falls back when the xAI STT service rejects the upload.
 *
 * @param options - Audio payload plus optional primary and fallback request overrides.
 * @returns Transcript text from xAI or the configured fallback provider.
 */
export async function transcribeAudioWithFallback(options: TranscribeAudioWithFallbackOptions): Promise<string> {
  try {
    return await transcribeXaiAudio(options);
  } catch (error) {
    console.warn('[Transcribe] xAI STT failed, falling back to OpenAI:', error);

    const fallbackTranscribe = options.fallbackTranscribe ?? transcribeWithOpenAI;
    return fallbackTranscribe({
      audio: options.audio,
      filename: options.filename ?? 'recording.webm',
      mediaType: options.mediaType ?? options.audio.type ?? 'audio/webm',
    });
  }
}

/**
 * Generates spoken audio with xAI text-to-speech and returns a browser data URL.
 *
 * @param options - TTS input and optional request overrides.
 * @returns A data URL for direct playback in the current UI.
 */
export async function generateXaiSpeech(options: GenerateXaiSpeechOptions): Promise<string> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`${options.baseUrl ?? XAI_API_BASE_URL}/tts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getXaiApiKey(options.apiKey)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: options.text,
      voice_id: options.voiceId ?? 'eve',
      language: options.language ?? 'auto',
      format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`xAI speech generation failed: ${response.status} ${errorText}`);
  }

  const mimeType = response.headers.get('content-type') || 'audio/mpeg';
  const audioBuffer = await response.arrayBuffer();
  const base64Audio = Buffer.from(audioBuffer).toString('base64');
  return `data:${mimeType};base64,${base64Audio}`;
}
