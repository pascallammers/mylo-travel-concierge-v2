import { McpToolFailure } from '@/lib/mcp/http-mcp-tool';

export type ToolCallOutcome =
  | { status: 'succeeded'; response: unknown }
  | { status: 'failed'; error: string };

/** Minimal shape of the AI SDK step content parts this classifier reads. */
export interface StepContentPart {
  type: string;
  toolCallId?: string;
  output?: unknown;
  error?: unknown;
}

/**
 * Classifies one tool call from the AI SDK step content.
 *
 * @param toolCallId - Identifier of the tool call to classify.
 * @param content - Content parts emitted for the completed step.
 * @returns Persistable success output or failure reason.
 */
export function classifyToolCallOutcome(
  toolCallId: string,
  content: ReadonlyArray<StepContentPart>,
): ToolCallOutcome {
  const result = content.find(
    (part) => part.type === 'tool-result' && part.toolCallId === toolCallId,
  );
  if (result) {
    return { status: 'succeeded', response: result.output };
  }

  const failure = content.find(
    (part) => part.type === 'tool-error' && part.toolCallId === toolCallId,
  );
  if (failure) {
    const error = failure.error;
    return {
      status: 'failed',
      error:
        error instanceof McpToolFailure
          ? error.reason
          : error instanceof Error
            ? error.message
            : String(error),
    };
  }

  return { status: 'failed', error: 'no tool result returned' };
}
