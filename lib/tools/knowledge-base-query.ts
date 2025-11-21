import type { GenerativeModel } from '@google/generative-ai';
import type { GeminiFile } from '@/lib/gemini-file-manager';

export type KnowledgeBaseQueryStatus = 'found' | 'not_found' | 'empty' | 'error';

export type KnowledgeBaseQueryReason = 'no_files' | 'no_active_files' | 'not_found' | 'error';

export interface KnowledgeBaseQueryResult {
  status: KnowledgeBaseQueryStatus;
  answer?: string;
  reason?: KnowledgeBaseQueryReason;
}

export interface KnowledgeBaseQueryDependencies {
  /**
   * Lists all files available to the KB.
   */
  listFiles: () => Promise<GeminiFile[]>;
  /**
   * Minimal generative model interface for Gemini.
   */
  model: Pick<GenerativeModel, 'generateContent'>;
}

/**
 * Runs a Gemini file search backed knowledge-base query.
 *
 * @param query - User question to answer from KB files.
 * @param deps - Injected file lister and Gemini model for testability.
 * @returns Knowledge base lookup result with discriminated status.
 */
export async function queryKnowledgeBase(
  query: string,
  deps: KnowledgeBaseQueryDependencies,
): Promise<KnowledgeBaseQueryResult> {
  try {
    const files = await deps.listFiles();

    if (files.length === 0) {
      return { status: 'empty', reason: 'no_files' };
    }

    const activeFiles = files.filter((file) => file.state === 'ACTIVE');

    if (activeFiles.length === 0) {
      return { status: 'empty', reason: 'no_active_files' };
    }

    const fileParts = activeFiles.map((file) => ({
      fileData: {
        mimeType: file.mimeType,
        fileUri: file.uri,
      },
    }));

    const result = await deps.model.generateContent([
      {
        text:
          'Answer the following question using ONLY the provided files. ' +
          'If the answer is not in the files, respond with the token NOT_FOUND.' +
          `\n\nQuestion: ${query}`,
      },
      ...fileParts,
    ]);

    const response = await result.response;
    const answer = response.text().trim();

    if (answer.toUpperCase().includes('NOT_FOUND')) {
      return { status: 'not_found', reason: 'not_found' };
    }

    return { status: 'found', answer };
  } catch (error) {
    console.error('Knowledge Base query failed:', error);
    return { status: 'error', reason: 'error' };
  }
}
