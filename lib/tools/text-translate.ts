import { tool, generateText, Output, NoOutputGeneratedError } from 'ai';
import { z } from 'zod';
import { scira } from '@/ai/providers';

export const textTranslateTool = tool({
  description: 'Translate text from one language to another.',
  inputSchema: z.object({
    text: z.string().describe('The text to translate.'),
    to: z.string().describe('The language to translate to (e.g., French).'),
  }),
  execute: async ({ text, to }: { text: string; to: string }) => {
    try {
      const result = await generateText({
        model: scira.languageModel('scira-default'),
        system: `You are a helpful assistant that translates text from one language to another.`,
        prompt: `Translate the following text to ${to} language: ${text}`,
        experimental_output: Output.object({
          schema: z.object({
            translatedText: z.string(),
            detectedLanguage: z.string(),
          }),
        }),
      });
      const translation = result.experimental_output;
      console.log(translation);
      return {
        translatedText: translation?.translatedText ?? text,
        detectedLanguage: translation?.detectedLanguage ?? 'unknown',
      };
    } catch (error) {
      if (NoOutputGeneratedError.isInstance(error)) {
        console.error('Failed to translate text:', (error as any).text);
        return { translatedText: text, detectedLanguage: 'unknown' };
      }
      throw error;
    }
  },
});
