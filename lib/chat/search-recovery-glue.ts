import type { InferUIMessageChunk, TextStreamPart, UIMessageStreamWriter } from 'ai';
import { markdownJoinerTransform } from '@/lib/parser';
import type { ChatMessage } from '@/lib/types';
import { recoverPartialOutput, type RecoveryLocale } from './stream-failure-recovery';
import type { ToolResultCache } from './tool-result-cache';

type RecoveryUiChunk = InferUIMessageChunk<ChatMessage>;
type RecoveryToolSet = Record<string, never>;
type RecoveryTextChunk = TextStreamPart<RecoveryToolSet>;
interface SearchToolResultChunk {
  type: string;
  preliminary?: boolean;
  toolName?: string;
  toolCallId?: string;
  output?: unknown;
}

interface SearchStepToolResult {
  toolName?: string;
  toolCallId?: string;
  output?: unknown;
}

interface SearchStepToolCall {
  toolName?: string;
  toolCallId?: string;
}

interface HandleSearchStreamCompletionOptions {
  cache: ToolResultCache;
  streamId: string;
  finishReason: string;
  locale: RecoveryLocale;
  writer: UIMessageStreamWriter<ChatMessage>;
  textId?: string;
  recordRecoveryUsed?: () => Promise<void> | void;
}

/**
 * Runs search-stream recovery for a terminal stream state and always evicts cache.
 *
 * @param options - Cache, stream metadata, writer, and optional recovery recorder.
 * @returns True when recovery markdown was written to the stream.
 */
export async function handleSearchStreamCompletion(
  options: HandleSearchStreamCompletionOptions,
): Promise<boolean> {
  try {
    const recovered = recoverPartialOutput(
      options.cache.get(options.streamId),
      options.finishReason,
      options.locale,
    );

    if (!recovered) {
      return false;
    }

    await writeRecoveryMarkdown(
      options.writer,
      recovered.content,
      options.textId ?? `recovery-${options.streamId}`,
    );
    await options.recordRecoveryUsed?.();
    return true;
  } finally {
    options.cache.evict(options.streamId);
  }
}

/**
 * Stores a completed AI SDK tool-result chunk in the stream-scoped cache.
 *
 * @param cache - Cache instance used by the search stream.
 * @param streamId - Stream id that owns this tool output.
 * @param chunk - AI SDK text stream chunk.
 * @returns True when the chunk was cached.
 */
export function cacheSearchToolResultChunk(
  cache: ToolResultCache,
  streamId: string,
  chunk: SearchToolResultChunk,
): boolean {
  if (
    chunk.type !== 'tool-result' ||
    chunk.preliminary ||
    !chunk.toolName ||
    !chunk.toolCallId
  ) {
    return false;
  }

  cache.set(streamId, chunk.toolName, chunk.toolCallId, chunk.output);
  return true;
}

/**
 * Stores completed AI SDK step tool results in the stream-scoped cache.
 *
 * @param cache - Cache instance used by the search stream.
 * @param streamId - Stream id that owns these tool outputs.
 * @param toolResults - AI SDK step tool results.
 * @returns Number of cached tool results.
 */
export function cacheSearchStepToolResults(
  cache: ToolResultCache,
  streamId: string,
  toolResults: SearchStepToolResult[] | undefined,
  toolCalls: SearchStepToolCall[] | undefined = undefined,
): number {
  if (!toolResults) {
    return 0;
  }

  const toolNamesByCallId = new Map(
    (toolCalls ?? [])
      .filter((toolCall) => toolCall.toolCallId && toolCall.toolName)
      .map((toolCall) => [toolCall.toolCallId as string, toolCall.toolName as string]),
  );
  let cachedCount = 0;
  for (const result of toolResults) {
    if (!result.toolCallId) {
      continue;
    }
    const toolName = result.toolName ?? toolNamesByCallId.get(result.toolCallId);
    if (!toolName) {
      continue;
    }
    cache.set(streamId, toolName, result.toolCallId, result.output);
    cachedCount += 1;
  }
  return cachedCount;
}

/**
 * Writes recovery markdown through the same markdown joiner transform as normal output.
 *
 * @param writer - UI message stream writer.
 * @param markdown - Recovery markdown content.
 * @param textId - Text part id for the synthetic assistant text.
 * @returns Promise that resolves after all chunks were written.
 */
export async function writeRecoveryMarkdown(
  writer: UIMessageStreamWriter<ChatMessage>,
  markdown: string,
  textId: string,
): Promise<void> {
  const chunks = await createRecoveryUiChunks(markdown, textId);
  for (const chunk of chunks) {
    writer.write(chunk);
  }
}

/**
 * Converts markdown into UI stream chunks after applying markdownJoinerTransform.
 *
 * @param markdown - Markdown content to stream.
 * @param textId - Text part id.
 * @returns UI message chunks suitable for UIMessageStreamWriter.write.
 */
export async function createRecoveryUiChunks(
  markdown: string,
  textId: string,
): Promise<RecoveryUiChunk[]> {
  const input: RecoveryTextChunk[] = [
    { type: 'text-start', id: textId },
    { type: 'text-delta', id: textId, text: markdown },
    { type: 'text-end', id: textId },
  ];

  const transformed = await runMarkdownJoiner(input);
  return transformed.map(toUiChunk);
}

async function runMarkdownJoiner(input: RecoveryTextChunk[]): Promise<RecoveryTextChunk[]> {
  const output: RecoveryTextChunk[] = [];
  const readable = new ReadableStream<RecoveryTextChunk>({
    start(controller) {
      for (const chunk of input) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  const writable = new WritableStream<RecoveryTextChunk>({
    write(chunk) {
      output.push(chunk);
    },
  });

  await readable.pipeThrough(markdownJoinerTransform<RecoveryToolSet>()()).pipeTo(writable);
  return output;
}

function toUiChunk(chunk: RecoveryTextChunk): RecoveryUiChunk {
  if (chunk.type === 'text-delta') {
    return { type: 'text-delta', id: chunk.id, delta: chunk.text };
  }

  if (chunk.type === 'text-start' || chunk.type === 'text-end') {
    return { type: chunk.type, id: chunk.id };
  }

  throw new Error(`Unsupported recovery stream chunk: ${chunk.type}`);
}
