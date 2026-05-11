export type SuggestedQuestionHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const MAX_CONTEXT_CHARS = 3000;
const MAX_QUESTIONS = 3;
const MAX_QUESTION_LENGTH = 150;

function truncateContext(text: string): string {
  const trimmed = text.trim();

  if (trimmed.length <= MAX_CONTEXT_CHARS) {
    return trimmed;
  }

  return trimmed.slice(-MAX_CONTEXT_CHARS).trim();
}

function getLastContentByRole(history: SuggestedQuestionHistoryMessage[], role: SuggestedQuestionHistoryMessage['role']) {
  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index];

    if (message.role === role) {
      return message.content.trim();
    }
  }

  return '';
}

function normalizeQuestionLine(line: string): string {
  return line
    .trim()
    .replace(/^```(?:text)?/i, '')
    .replace(/```$/i, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .trim();
}

/**
 * Builds the plain-text prompt for follow-up question generation.
 *
 * @param history - Recent user and assistant messages from the chat.
 * @returns A prompt string when both sides have content, otherwise null.
 */
export function buildSuggestedQuestionsPrompt(history: SuggestedQuestionHistoryMessage[]): string | null {
  const userMessage = getLastContentByRole(history, 'user');
  const assistantMessage = getLastContentByRole(history, 'assistant');

  if (!userMessage || !assistantMessage) {
    return null;
  }

  return [
    'Gesprächsverlauf:',
    '',
    'Nutzer:',
    truncateContext(userMessage),
    '',
    'Assistant:',
    truncateContext(assistantMessage),
    '',
    'Erstelle genau 3 natürliche Folgefragen zu diesem Gespräch.',
    'Gib nur die Fragen zurück, eine Frage pro Zeile.',
  ].join('\n');
}

/**
 * Parses a plain-text model response into safe follow-up questions.
 *
 * @param text - Raw model response from the follow-up generator.
 * @returns Up to three unique questions ending with a question mark.
 */
export function parseSuggestedQuestionsText(text: string): string[] {
  const questions: string[] = [];
  const seen = new Set<string>();

  for (const line of text.split('\n')) {
    const question = normalizeQuestionLine(line);
    const key = question.toLocaleLowerCase('de-DE');

    if (
      !question.endsWith('?') ||
      question.length > MAX_QUESTION_LENGTH ||
      question.includes('<function_call') ||
      question.includes('</function_call>') ||
      seen.has(key)
    ) {
      continue;
    }

    questions.push(question);
    seen.add(key);

    if (questions.length === MAX_QUESTIONS) {
      break;
    }
  }

  return questions;
}
