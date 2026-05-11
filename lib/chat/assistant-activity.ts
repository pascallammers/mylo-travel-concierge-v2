import type { ChatMessage } from '@/lib/types';

type MessagePart = ChatMessage['parts'][number];

function isNonEmptyTextPart(part: MessagePart): boolean {
  return part.type === 'text' && part.text.trim().length > 0;
}

function hasStepStartBefore(parts: readonly MessagePart[], partIndex: number): boolean {
  return parts.slice(0, partIndex).some((part) => part.type === 'step-start');
}

function hasNonEmptyTextAfter(parts: readonly MessagePart[], partIndex: number): boolean {
  return parts.slice(partIndex + 1).some(isNonEmptyTextPart);
}

/**
 * Decides whether an activity indicator should include the MYLO logo.
 *
 * @param parts - Parts in the current assistant message.
 * @param partIndex - Index of the part rendering the indicator.
 * @returns True when no previous step-start already rendered the logo.
 */
export function shouldRenderAssistantActivityLogo(parts: readonly MessagePart[], partIndex: number): boolean {
  return !hasStepStartBefore(parts, partIndex);
}

/**
 * Keeps the step-start indicator active until assistant text appears.
 *
 * @param status - Current chat stream status.
 * @param parts - Parts in the current assistant message.
 * @param partIndex - Index of the step-start part.
 * @returns True when the step-start needs to show typing dots itself.
 */
export function shouldShowStepStartActivity(
  status: string,
  parts: readonly MessagePart[],
  partIndex: number,
): boolean {
  return status === 'streaming' && !hasNonEmptyTextAfter(parts, partIndex);
}

/**
 * Keeps flight-search typing dots visible while the model writes the final answer.
 *
 * @param status - Current chat stream status.
 * @param parts - Parts in the current assistant message.
 * @param partIndex - Index of the flight-search tool part.
 * @returns True when the tool has finished but no assistant text has streamed yet.
 */
export function shouldShowFlightSearchOutputActivity(
  status: string,
  parts: readonly MessagePart[],
  partIndex: number,
): boolean {
  return status === 'streaming' && !hasNonEmptyTextAfter(parts, partIndex);
}
