import { tool } from 'ai';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiFileManager } from '@/lib/gemini-file-manager';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export const knowledgeBaseTool = tool({
    description: 'Search the internal Knowledge Base (documents, policies, FAQs) to answer questions. Use this BEFORE searching the web if the question might be about internal company information.',
    inputSchema: z.object({
        query: z.string().describe('The question to ask the Knowledge Base'),
    }),
    execute: async ({ query }: { query: string }) => {
        try {
            const files = await GeminiFileManager.listFiles();

            if (files.length === 0) {
                return 'The Knowledge Base is empty.';
            }

            // Filter for active files
            const activeFiles = files.filter(f => f.state === 'ACTIVE');

            if (activeFiles.length === 0) {
                return 'No active files in the Knowledge Base.';
            }

            // Construct the prompt with file context
            // We use Gemini 1.5 Pro for its large context window
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

            const fileParts = activeFiles.map(file => ({
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri,
                },
            }));

            const result = await model.generateContent([
                { text: `Answer the following question using ONLY the provided files. If the answer is not in the files, say "NOT_FOUND".\n\nQuestion: ${query}` },
                ...fileParts,
            ]);

            const response = await result.response;
            const answer = response.text();

            if (answer.includes('NOT_FOUND')) {
                return 'Information not found in the Knowledge Base.';
            }

            return `[Knowledge Base] ${answer}`;
        } catch (error) {
            console.error('Knowledge Base search error:', error);
            return 'Error searching Knowledge Base.';
        }
    },
});
