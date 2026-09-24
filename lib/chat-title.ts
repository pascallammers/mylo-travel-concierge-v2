import 'server-only';

import { generateText, type UIMessage } from 'ai';
import { scira } from '@/ai/providers';

/**
 * Generate a title for a chat already authorized by the server caller.
 * @param input - The initial user message.
 * @returns The generated title without resolving request state.
 */
export async function generateChatTitle({ message }: { message: UIMessage }) {
  const { text: title } = await generateText({
    model: scira.languageModel('scira-name'),
    system: `You are an expert title generator. You are given a message and you need to generate a short title based on it.

    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - the title should creative and unique
    - do not write anything other than the title
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}
