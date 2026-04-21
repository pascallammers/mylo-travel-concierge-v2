'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhoneCall, PhoneOff, Loader2, Mic, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  isVoiceResponseAudioDeltaEvent,
  isVoiceResponseTranscriptDeltaEvent,
} from '@/lib/xai/voice-client';
import { cn } from '@/lib/utils';

type VoiceModeStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

type VoiceModeDialogProps = {
  chatId: string;
  disabled?: boolean;
};

type RealtimeSessionResponse = {
  value: string;
  expiresAt: string;
  webSocketUrl: string;
  protocol: string;
  session: Record<string, unknown>;
};

type RealtimeEvent = {
  type: string;
  [key: string]: unknown;
};

const PCM_SAMPLE_RATE = 24000;

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function downsampleTo24k(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === PCM_SAMPLE_RATE) {
    return floatTo16BitPCM(input);
  }

  const ratio = inputSampleRate / PCM_SAMPLE_RATE;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.min(input.length, Math.round((offsetResult + 1) * ratio));
    let total = 0;
    let count = 0;

    for (let sampleIndex = offsetBuffer; sampleIndex < nextOffsetBuffer; sampleIndex += 1) {
      total += input[sampleIndex] ?? 0;
      count += 1;
    }

    result[offsetResult] = count > 0 ? total / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return floatTo16BitPCM(result);
}

function int16ToBase64(int16Array: Int16Array): string {
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToFloat32(base64Audio: string): Float32Array {
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const pcm = new Int16Array(bytes.buffer);
  const output = new Float32Array(pcm.length);

  for (let index = 0; index < pcm.length; index += 1) {
    output[index] = pcm[index] / 0x8000;
  }

  return output;
}

function statusLabel(status: VoiceModeStatus): string {
  switch (status) {
    case 'connecting':
      return 'Verbinde...';
    case 'listening':
      return 'Ich hoere zu';
    case 'thinking':
      return 'Ich denke nach';
    case 'speaking':
      return 'Ich antworte';
    case 'error':
      return 'Fehler';
    default:
      return 'Bereit';
  }
}

export function VoiceModeDialog({ chatId, disabled = false }: VoiceModeDialogProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<VoiceModeStatus>('idle');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [assistantTranscript, setAssistantTranscript] = useState('');

  const websocketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const playbackTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const currentResponseModeRef = useRef<'audio' | 'text' | null>(null);
  const functionCallNamesRef = useRef<Map<string, string>>(new Map());
  const sessionActiveRef = useRef(false);

  const canStart = useMemo(() => !disabled && !isSessionActive && status !== 'connecting', [disabled, isSessionActive, status]);

  const stopPlayback = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Ignore stop race conditions.
      }
    }

    activeSourcesRef.current.clear();

    if (audioContextRef.current) {
      playbackTimeRef.current = audioContextRef.current.currentTime;
    }
  }, []);

  const cleanupSession = useCallback(async () => {
    sessionActiveRef.current = false;
    setIsSessionActive(false);

    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    stopPlayback();

    if (websocketRef.current) {
      const socket = websocketRef.current;
      websocketRef.current = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'Voice session ended');
      }
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    functionCallNamesRef.current.clear();
    currentResponseModeRef.current = null;
  }, [stopPlayback]);

  const stopSession = useCallback(async () => {
    await cleanupSession();
    setStatus('idle');
  }, [cleanupSession]);

  const playAudioDelta = useCallback(async (delta: string) => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const samples = base64ToFloat32(delta);
    const audioBuffer = audioContext.createBuffer(1, samples.length, PCM_SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(samples);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    const startAt = Math.max(playbackTimeRef.current, audioContext.currentTime);
    source.start(startAt);
    playbackTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  }, []);

  const handleRealtimeEvent = useCallback(
    async (event: RealtimeEvent) => {
      if (isVoiceResponseAudioDeltaEvent(event.type)) {
        const delta = typeof event.delta === 'string' ? event.delta : '';
        if (!delta) return;
        setStatus('speaking');
        await playAudioDelta(delta);
        return;
      }

      if (isVoiceResponseTranscriptDeltaEvent(event.type)) {
        if (currentResponseModeRef.current && currentResponseModeRef.current !== 'audio') {
          return;
        }

        const delta = typeof event.delta === 'string' ? event.delta : '';
        if (!delta) return;

        currentResponseModeRef.current = 'audio';
        setAssistantTranscript((current) => current + delta);
        return;
      }

      switch (event.type) {
        case 'session.updated': {
          setStatus('listening');
          return;
        }
        case 'input_audio_buffer.speech_started': {
          setStatus('listening');
          setUserTranscript('');
          setAssistantTranscript('');
          currentResponseModeRef.current = null;
          stopPlayback();

          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({ type: 'response.cancel' }));
          }
          return;
        }
        case 'input_audio_buffer.speech_stopped': {
          setStatus('thinking');
          return;
        }
        case 'conversation.item.input_audio_transcription.completed': {
          const transcript = typeof event.transcript === 'string' ? event.transcript : '';
          if (transcript) {
            setUserTranscript(transcript);
          }
          return;
        }
        case 'response.created': {
          setStatus('thinking');
          setAssistantTranscript('');
          currentResponseModeRef.current = null;
          return;
        }
        case 'response.output_item.added':
        case 'response.output_item.done': {
          const item = event.item as { id?: string; name?: string; type?: string } | undefined;
          if (item?.type === 'function_call' && item.id && item.name) {
            functionCallNamesRef.current.set(item.id, item.name);
          }
          return;
        }
        case 'response.text.delta': {
          if (currentResponseModeRef.current && currentResponseModeRef.current !== 'text') {
            return;
          }

          const delta = typeof event.delta === 'string' ? event.delta : '';
          if (!delta) return;

          currentResponseModeRef.current = 'text';
          setAssistantTranscript((current) => current + delta);
          return;
        }
        case 'response.function_call_arguments.done': {
          const itemId = typeof event.item_id === 'string' ? event.item_id : '';
          const callId = typeof event.call_id === 'string' ? event.call_id : '';
          const toolName = functionCallNamesRef.current.get(itemId);

          if (!toolName || !callId || !websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
            return;
          }

          const response = await fetch('/api/voice/tools', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              toolName,
              args: event.arguments,
              chatId,
            }),
          });

          const payload = (await response.json()) as {
            ok?: boolean;
            result?: unknown;
            error?: string;
          };

          websocketRef.current.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify(payload.ok ? payload.result : { error: payload.error ?? 'Tool failed' }),
              },
            }),
          );
          websocketRef.current.send(JSON.stringify({ type: 'response.create' }));
          return;
        }
        case 'response.done': {
          setStatus('listening');
          currentResponseModeRef.current = null;
          return;
        }
        case 'error': {
          setStatus('error');
          const message = typeof event.error === 'object' && event.error && 'message' in event.error
            ? String(event.error.message)
            : 'Voice session error';
          toast.error(message);
          return;
        }
        default:
          return;
      }
    },
    [chatId, playAudioDelta, stopPlayback],
  );

  const startSession = useCallback(async () => {
    try {
      if (typeof window === 'undefined') {
        toast.error('Voice mode is only available in the browser.');
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('This browser does not support microphone input.');
        return;
      }

      setStatus('connecting');
      setUserTranscript('');
      setAssistantTranscript('');

      const [stream, sessionResponse] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }),
        fetch('/api/voice/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }),
      ]);

      if (!sessionResponse.ok) {
        throw new Error('Voice session could not be created.');
      }

      const sessionData = (await sessionResponse.json()) as RealtimeSessionResponse;
      const audioContext = new AudioContext();
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const processorNode = audioContext.createScriptProcessor(4096, 1, 1);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceNodeRef.current = sourceNode;
      processorNodeRef.current = processorNode;
      playbackTimeRef.current = audioContext.currentTime;

      const websocket = new WebSocket(sessionData.webSocketUrl, [sessionData.protocol]);
      websocketRef.current = websocket;

      processorNode.onaudioprocess = (event) => {
        if (!sessionActiveRef.current || websocket.readyState !== WebSocket.OPEN) {
          return;
        }

        const input = event.inputBuffer.getChannelData(0);
        const pcm = downsampleTo24k(input, audioContext.sampleRate);
        websocket.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: int16ToBase64(pcm),
          }),
        );
      };

      sourceNode.connect(processorNode);
      processorNode.connect(audioContext.destination);

      websocket.onopen = () => {
        sessionActiveRef.current = true;
        setIsSessionActive(true);
        websocket.send(
          JSON.stringify({
            type: 'session.update',
            session: sessionData.session,
          }),
        );
      };

      websocket.onmessage = (messageEvent) => {
        const event = JSON.parse(messageEvent.data) as RealtimeEvent;
        void handleRealtimeEvent(event);
      };

      websocket.onerror = () => {
        setStatus('error');
        toast.error('The realtime voice connection failed.');
      };

      websocket.onclose = () => {
        void cleanupSession();
        setStatus('idle');
      };
    } catch (error) {
      console.error('[Voice Mode] Failed to start session:', error);
      await cleanupSession();
      setStatus('error');
      toast.error(error instanceof Error ? error.message : 'Voice mode could not be started.');
    }
  }, [cleanupSession, handleRealtimeEvent]);

  useEffect(() => {
    if (!open) {
      void stopSession();
    }
  }, [open, stopSession]);

  useEffect(() => {
    return () => {
      void cleanupSession();
    };
  }, [cleanupSession]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="group rounded-full transition-colors duration-200 !size-8 border-0 !shadow-none hover:!bg-primary/30 hover:!border-0"
          disabled={disabled}
        >
          <PhoneCall className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Voice mode</DialogTitle>
          <DialogDescription>Live sprechen mit Mylo ueber xAI Realtime Voice.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {status === 'connecting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
              <span>{statusLabel(status)}</span>
            </div>
            <span
              className={cn(
                'inline-flex rounded-md px-2 py-1 text-xs font-medium',
                status === 'error' && 'bg-destructive/10 text-destructive',
                status === 'listening' && 'bg-emerald-500/10 text-emerald-600',
                status === 'speaking' && 'bg-primary/10 text-primary',
                status === 'thinking' && 'bg-amber-500/10 text-amber-600',
                (status === 'idle' || status === 'connecting') && 'bg-muted text-muted-foreground',
              )}
            >
              xAI
            </span>
          </div>

          <div className="grid gap-3">
            <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Mic className="h-3.5 w-3.5" />
                <span>Du</span>
              </div>
              <p className="min-h-12 text-sm text-foreground">{userTranscript || 'Noch keine Transkription.'}</p>
            </div>

            <div className="rounded-lg border border-border/60 bg-background px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <PhoneCall className="h-3.5 w-3.5" />
                <span>Mylo</span>
              </div>
              <p className="min-h-20 text-sm text-foreground">{assistantTranscript || 'Mylo wartet auf deine Stimme.'}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => void stopSession()} disabled={!isSessionActive && status === 'idle'}>
              <PhoneOff className="mr-2 h-4 w-4" />
              Beenden
            </Button>
            <Button onClick={() => void startSession()} disabled={!canStart}>
              {status === 'connecting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
              Starten
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
