import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  shouldRenderAssistantActivityLogo,
  shouldShowFlightSearchOutputActivity,
  shouldShowStepStartActivity,
} from './assistant-activity';
import type { ChatMessage } from '@/lib/types';

type MessagePart = ChatMessage['parts'][number];

const stepStart = { type: 'step-start' } as MessagePart;
const emptyText = { type: 'text', text: '' } as MessagePart;
const visibleText = { type: 'text', text: 'Here are your flight options.' } as MessagePart;
const flightOutput = {
  type: 'tool-search_flights',
  state: 'output-available',
  output: 'raw flight data',
  input: {},
  toolCallId: 'flight-tool-1',
} as MessagePart;
const flightInput = {
  type: 'tool-search_flights',
  state: 'input-available',
  input: {},
  toolCallId: 'flight-tool-1',
} as MessagePart;

describe('assistant activity indicator rules', () => {
  it('does not render a second MYLO logo after step-start already rendered it', () => {
    const parts = [stepStart, flightInput];

    assert.strictEqual(shouldRenderAssistantActivityLogo(parts, 1), false);
  });

  it('keeps dots visible after flight search output while final text is still pending', () => {
    const parts = [stepStart, flightOutput, emptyText];

    assert.strictEqual(shouldShowFlightSearchOutputActivity('streaming', parts, 1), true);
  });

  it('hides flight dots once assistant text starts streaming', () => {
    const parts = [stepStart, flightOutput, visibleText];

    assert.strictEqual(shouldShowFlightSearchOutputActivity('streaming', parts, 1), false);
  });

  it('keeps step-start dots active while tool work is running but assistant text is missing', () => {
    assert.strictEqual(shouldShowStepStartActivity('streaming', [stepStart], 0), true);
    assert.strictEqual(shouldShowStepStartActivity('streaming', [stepStart, flightInput], 0), true);
    assert.strictEqual(shouldShowStepStartActivity('streaming', [stepStart, flightOutput, visibleText], 0), false);
  });
});
