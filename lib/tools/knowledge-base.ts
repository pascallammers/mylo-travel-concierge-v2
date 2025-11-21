import { tool } from 'ai';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiFileManager } from '@/lib/gemini-file-manager';
import { queryKnowledgeBase } from './knowledge-base-query';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export const knowledgeBaseTool = tool({
    description: 'Search the internal Knowledge Base (documents, policies, FAQs) to answer questions. Use this BEFORE searching the web if the question might be about internal company information.',
    inputSchema: z.object({
        query: z.string().describe('The question to ask the Knowledge Base'),
    }),
    execute: async ({ query }: { query: string }) => {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
            const kbResult = await queryKnowledgeBase(query, {
                listFiles: () => GeminiFileManager.listFiles(),
                model,
            });

            if (kbResult.status === 'empty') {
                return kbResult.reason === 'no_active_files'
                    ? 'No active files in the Knowledge Base.'
                    : 'The Knowledge Base is empty.';
            }

            if (kbResult.status === 'not_found') {
                return 'Information not found in the Knowledge Base.';
            }

            if (kbResult.status === 'found' && kbResult.answer) {
                return `[Knowledge Base] ${kbResult.answer}`;
            }

            return 'Error searching Knowledge Base.';
        } catch (error) {
            console.error('Knowledge Base search error:', error);
            return 'Error searching Knowledge Base.';
        }
    },
});
