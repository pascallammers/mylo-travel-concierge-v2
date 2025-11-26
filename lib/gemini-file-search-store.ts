/**
 * Gemini File Search Store Service - Managed RAG system using Google's
 * File Search Stores API for document indexing, querying, and management.
 * @module gemini-file-search-store
 */

import { GoogleGenAI } from '@google/genai';
import type {
  FileSearchStore,
  UploadToFileSearchStoreOperation,
  GroundingChunk,
} from '@google/genai';
import { KB_CONFIG } from '@/lib/config/knowledge-base';
import { KBError, KBErrorCode, wrapAsKBError } from '@/lib/errors/kb-errors';

// ============================================================================
// Types
// ============================================================================

/** Configuration options for file upload operations. */
export interface FileUploadOptions {
  /** MIME type of the file (required by Gemini API). */
  mimeType?: string;
  /** Configuration for how the document should be chunked. */
  chunkingConfig?: {
    maxTokensPerChunk?: number;
    maxOverlapTokens?: number;
  };
  /** Custom metadata to attach to the document for filtering. */
  customMetadata?: Array<{
    key: string;
    stringValue?: string;
    numericValue?: number;
  }>;
}

/** Result of a successful file upload operation. */
export interface FileUploadResult {
  documentName: string;
  storeName: string;
  status: 'indexed' | 'pending' | 'failed';
}

/** Options for querying the file search store. */
export interface QueryOptions {
  /** Metadata filter expression using AIP-160 syntax (e.g., 'author="John"') */
  metadataFilter?: string;
}

/** Represents a source chunk returned from a query. */
export interface QuerySource {
  title: string;
  chunk: string;
  uri?: string;
}

/** Result of a query operation against the file search store. */
export interface QueryResult {
  answer: string;
  sources: QuerySource[];
  confidence: number;
  status: 'found' | 'not_found' | 'error';
}

/** Document metadata from the file search store. */
export interface DocumentInfo {
  name: string;
  displayName: string;
  state?: string;
}

// ============================================================================
// Constants & Client Initialization
// ============================================================================

const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_ATTEMPTS = 60;
const DEFAULT_QUERY_MODEL = 'gemini-2.5-flash';
const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_CHUNK_OVERLAP = 50;

function createClient(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

/**
 * Sanitizes a display name for use in HTTP headers.
 * Removes diacritics (ü→u, ö→o, ä→a) and replaces non-ASCII characters.
 * @param name - Original display name (may contain unicode)
 * @returns ASCII-safe display name
 */
function sanitizeDisplayName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (combining marks)
    .replace(/[^\x00-\x7F]/g, '_');  // Replace remaining non-ASCII with underscore
}

// ============================================================================
// GeminiFileSearchStore Class
// ============================================================================

/**
 * Service class for managing Gemini File Search Stores.
 * Provides methods for creating stores, uploading/deleting documents,
 * and querying the knowledge base with automatic RAG retrieval.
 */
export class GeminiFileSearchStore {
  private storeName: string | null = null;
  private client: GoogleGenAI;

  constructor() {
    this.client = createClient();
  }

  /**
   * Gets an existing file search store or creates a new one if it doesn't exist.
   * @param displayName - Human-readable name for the store
   * @returns The store's resource name (e.g., 'fileSearchStores/abc123')
   * @throws KBError if store creation fails
   */
  async getOrCreateStore(
    displayName: string = KB_CONFIG.fileSearchStoreName
  ): Promise<string> {
    // Return cached store name if available
    if (this.storeName) {
      return this.storeName;
    }

    try {
      // Check if store already exists
      const existingStore = await this.findStoreByDisplayName(displayName);
      if (existingStore?.name) {
        this.storeName = existingStore.name;
        console.log(`Using existing file search store: ${this.storeName}`);
        return this.storeName;
      }

      // Create new store
      const store = await this.client.fileSearchStores.create({
        config: { displayName },
      });

      if (!store.name) {
        throw new KBError(
          KBErrorCode.GEMINI_API_ERROR,
          'Store creation returned no name'
        );
      }

      this.storeName = store.name;
      console.log(`Created new file search store: ${this.storeName}`);
      return this.storeName;
    } catch (error) {
      if (error instanceof KBError) {
        throw error;
      }
      console.error('Error getting/creating file search store:', error);
      throw new KBError(
        KBErrorCode.GEMINI_API_ERROR,
        `Failed to get or create file search store: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /** Finds a file search store by its display name. */
  private async findStoreByDisplayName(
    displayName: string
  ): Promise<FileSearchStore | undefined> {
    try {
      const storesPager = await this.client.fileSearchStores.list();
      for await (const store of storesPager) {
        if (store.displayName === displayName) {
          return store;
        }
      }
      return undefined;
    } catch (error) {
      console.error('Error listing file search stores:', error);
      return undefined;
    }
  }

  /**
   * Uploads and indexes a file to the file search store. Waits for indexing
   * to complete before returning. File will be automatically chunked and embedded.
   * @param filePath - Path to the file to upload
   * @param displayName - Human-readable name for the document
   * @param options - Optional upload configuration
   * @returns Upload result with document name and status
   * @throws KBError if upload or indexing fails
   */
  async uploadFile(
    filePath: string,
    displayName: string,
    options?: FileUploadOptions
  ): Promise<FileUploadResult> {
    try {
      const storeName = await this.getOrCreateStore();

      // Build chunking config
      const chunkingConfig = options?.chunkingConfig
        ? {
            whiteSpaceConfig: {
              maxTokensPerChunk:
                options.chunkingConfig.maxTokensPerChunk ?? DEFAULT_CHUNK_SIZE,
              maxOverlapTokens:
                options.chunkingConfig.maxOverlapTokens ?? DEFAULT_CHUNK_OVERLAP,
            },
          }
        : undefined;

      // Build custom metadata
      const customMetadata = options?.customMetadata?.map((meta) => ({
        key: meta.key,
        ...(meta.stringValue !== undefined && { stringValue: meta.stringValue }),
        ...(meta.numericValue !== undefined && { numericValue: meta.numericValue }),
      }));

      // Sanitize display name for HTTP headers (remove unicode/diacritics)
      const safeDisplayName = sanitizeDisplayName(displayName);

      // Start upload with explicit mimeType
      const operation = await this.client.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: storeName,
        file: filePath,
        config: {
          displayName: safeDisplayName,
          mimeType: options?.mimeType,
          chunkingConfig,
          customMetadata,
        },
      });

      // Wait for indexing to complete
      const completedOperation = await this.waitForOperation(operation);

      if (!completedOperation.response?.documentName) {
        throw new KBError(
          KBErrorCode.INDEXING_FAILED,
          'Upload completed but no document name returned'
        );
      }

      console.log(
        `Document uploaded and indexed: ${completedOperation.response.documentName}`
      );

      return {
        documentName: completedOperation.response.documentName,
        storeName,
        status: 'indexed',
      };
    } catch (error) {
      if (error instanceof KBError) {
        throw error;
      }
      console.error('Error uploading file:', error);
      throw new KBError(
        KBErrorCode.UPLOAD_FAILED,
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /** Polls an operation until it completes or fails. */
  private async waitForOperation(
    operation: UploadToFileSearchStoreOperation
  ): Promise<UploadToFileSearchStoreOperation> {
    let currentOperation = operation;
    let attempts = 0;

    while (!currentOperation.done && attempts < MAX_POLLING_ATTEMPTS) {
      await this.sleep(POLLING_INTERVAL_MS);
      attempts++;

      if (!currentOperation.name) {
        throw new KBError(
          KBErrorCode.INDEXING_FAILED,
          'Operation has no name for polling'
        );
      }

      // Poll for updated status
      const updated = await this.client.operations.get({
        operation: currentOperation,
      });

      currentOperation = updated as UploadToFileSearchStoreOperation;
    }

    if (!currentOperation.done) {
      throw new KBError(
        KBErrorCode.INDEXING_FAILED,
        `Operation timed out after ${MAX_POLLING_ATTEMPTS * POLLING_INTERVAL_MS / 1000} seconds`
      );
    }

    if (currentOperation.error) {
      throw new KBError(
        KBErrorCode.INDEXING_FAILED,
        `Operation failed: ${JSON.stringify(currentOperation.error)}`,
        currentOperation.error
      );
    }

    return currentOperation;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Queries the file search store using semantic search with FileSearch tool.
   * @param query - The search query or question
   * @param options - Optional query configuration
   * @returns Query result with answer, sources, and confidence
   */
  async query(query: string, options?: QueryOptions): Promise<QueryResult> {
    try {
      const storeName = await this.getOrCreateStore();

      const response = await this.client.models.generateContent({
        model: DEFAULT_QUERY_MODEL,
        contents: query,
        config: {
          tools: [
            {
              fileSearch: {
                fileSearchStoreNames: [storeName],
                metadataFilter: options?.metadataFilter,
              },
            },
          ],
        },
      });

      // Extract text answer
      const answer = response.text ?? '';

      // Extract sources from grounding metadata
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const sources = this.extractSources(groundingMetadata?.groundingChunks);

      // Determine confidence based on sources
      const confidence = sources.length > 0 ? 0.9 : 0.3;
      const status = sources.length > 0 ? 'found' : 'not_found';

      return {
        answer,
        sources,
        confidence,
        status,
      };
    } catch (error) {
      console.error('Error querying file search store:', error);

      // Return error result instead of throwing to allow graceful degradation
      return {
        answer: '',
        sources: [],
        confidence: 0,
        status: 'error',
      };
    }
  }

  /** Extracts source information from grounding chunks. */
  private extractSources(chunks?: GroundingChunk[]): QuerySource[] {
    if (!chunks || chunks.length === 0) {
      return [];
    }

    return chunks
      .filter((chunk) => chunk.retrievedContext)
      .map((chunk) => ({
        title: chunk.retrievedContext?.title ?? 'Unknown',
        chunk: chunk.retrievedContext?.text ?? '',
        uri: chunk.retrievedContext?.uri,
      }));
  }

  /**
   * Deletes a document from the file search store.
   * @param documentName - Full document resource name
   * @throws KBError if deletion fails
   */
  async deleteDocument(documentName: string): Promise<void> {
    try {
      await this.client.fileSearchStores.documents.delete({
        name: documentName,
        config: { force: true },
      });

      console.log(`Deleted document: ${documentName}`);
    } catch (error) {
      console.error('Error deleting document:', error);
      throw new KBError(
        KBErrorCode.DELETE_FAILED,
        `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      );
    }
  }

  /**
   * Lists all documents in the file search store.
   * @returns Array of document information
   * @throws KBError if listing fails
   */
  async listDocuments(): Promise<DocumentInfo[]> {
    try {
      const storeName = await this.getOrCreateStore();

      const documentsPager = await this.client.fileSearchStores.documents.list({
        parent: storeName,
      });

      const documents: DocumentInfo[] = [];
      for await (const doc of documentsPager) {
        if (doc.name) {
          documents.push({
            name: doc.name,
            displayName: doc.displayName ?? 'Unnamed',
            state: doc.state,
          });
        }
      }

      return documents;
    } catch (error) {
      console.error('Error listing documents:', error);
      throw wrapAsKBError(error, 'Failed to list documents');
    }
  }

  /** Gets the current store name, if initialized. */
  getStoreName(): string | null {
    return this.storeName;
  }

  /** Clears the cached store name, forcing re-initialization on next operation. */
  clearStoreCache(): void {
    this.storeName = null;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Pre-configured singleton instance of GeminiFileSearchStore. */
export const geminiFileSearchStore = new GeminiFileSearchStore();
