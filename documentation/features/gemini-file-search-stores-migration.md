# Gemini File Search Stores API Migration

## 1. Overview

### Problem Statement
Die aktuelle Knowledge Base Implementation nutzt die **alte Gemini Files API** mit manuellem RAG:
- Manuelles Prompt-Building mit File-Content
- Keine automatische Chunking/Embedding
- Low Confidence Results (0.5 bei 0.7 Threshold)
- Unzuverlaessige Antworten

### Solution
Migration zur neuen **Gemini File Search Stores API** (released Nov 2025):
- Fully managed RAG system
- Automatisches Chunking, Embedding, Indexing
- Built-in Retrieval mit Citations
- Deutlich bessere Retrieval-Qualitaet

### Goals
1. Migration von Files API → File Search Stores API
2. Verbesserung der Retrieval-Qualitaet
3. Automatisches Grounding mit Citations
4. Kosteneffizient ($0.15 pro 1M tokens fuer Indexing, Query ist kostenlos)

---

## 2. Technical Comparison

### Current Implementation (OLD)
```typescript
// 1. Upload file via Files API
const file = await fileManager.uploadFile(path, { mimeType });

// 2. Manual prompt construction with file reference
const result = await model.generateContent([
  { fileData: { mimeType, fileUri: file.uri } },
  { text: "Answer based on this file: " + query }
]);
```

**Problems:**
- Keine semantische Suche
- Gesamtes File wird als Context gesendet
- Token-Limit bei grossen Files
- Keine Relevanz-Bewertung

### New Implementation (FILE SEARCH STORES)
```typescript
// 1. Create File Search Store (einmalig)
const store = await client.fileSearchStores.create({
  config: { display_name: 'mylo-knowledge-base' }
});

// 2. Upload & Index file (automatisches Chunking/Embedding)
await client.fileSearchStores.uploadToFileSearchStore({
  file: 'document.pdf',
  file_search_store_name: store.name,
  config: { display_name: 'My Document' }
});

// 3. Query with FileSearch tool (automatisches Retrieval)
const response = await client.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: query,
  config: {
    tools: [{
      file_search: {
        file_search_store_names: [store.name]
      }
    }]
  }
});

// 4. Citations sind automatisch in response.candidates[0].grounding_metadata
```

**Benefits:**
- Semantische Vektor-Suche
- Automatisches Chunking mit Overlap
- Nur relevante Chunks werden retrieved
- Built-in Citations
- Skaliert auf viele Dokumente

---

## 3. Architecture

### New Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN PANEL                                  │
│  ┌──────────────┐                                               │
│  │ File Upload  │──────────────────┐                            │
│  └──────────────┘                  │                            │
└────────────────────────────────────┼────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GEMINI FILE SEARCH STORES                      │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Upload     │───▶│   Chunking   │───▶│  Embedding   │       │
│  │   (PDF/MD)   │    │  (auto)      │    │ (gemini-emb) │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                   │              │
│                                                   ▼              │
│                                          ┌──────────────┐       │
│                                          │ Vector Store │       │
│                                          │  (indexed)   │       │
│                                          └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CHAT QUERY                                │
│                                                                  │
│  User Query ──▶ FileSearch Tool ──▶ Semantic Search ──▶ Answer  │
│                                            │                     │
│                                            ▼                     │
│                                    Grounding Metadata            │
│                                    (auto citations)              │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema Update

```sql
-- Neue Spalte fuer File Search Store Reference
ALTER TABLE kb_documents ADD COLUMN file_search_store_name TEXT;
ALTER TABLE kb_documents ADD COLUMN file_search_document_name TEXT;

-- Store-Konfiguration (optional, falls multiple stores)
CREATE TABLE kb_file_search_stores (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL UNIQUE,  -- z.B. "fileSearchStores/xyz123"
  display_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_default BOOLEAN DEFAULT FALSE
);
```

---

## 4. API Changes

### 4.1 New: GeminiFileSearchStore Service

Create `/lib/gemini-file-search-store.ts`:

```typescript
import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });

export class GeminiFileSearchStore {
  private storeName: string | null = null;

  /**
   * Initialize or get existing file search store
   */
  async getOrCreateStore(displayName: string = 'mylo-knowledge-base'): Promise<string> {
    if (this.storeName) return this.storeName;

    // Check if store exists
    const stores = await client.fileSearchStores.list();
    const existing = stores.find(s => s.display_name === displayName);
    
    if (existing) {
      this.storeName = existing.name;
      return this.storeName;
    }

    // Create new store
    const store = await client.fileSearchStores.create({
      config: { display_name: displayName }
    });
    this.storeName = store.name;
    return this.storeName;
  }

  /**
   * Upload and index a file
   */
  async uploadFile(
    filePath: string,
    displayName: string,
    options?: {
      chunkingConfig?: {
        maxTokensPerChunk?: number;
        maxOverlapTokens?: number;
      };
      customMetadata?: Array<{ key: string; string_value?: string; numeric_value?: number }>;
    }
  ): Promise<{ documentName: string; status: string }> {
    const storeName = await this.getOrCreateStore();

    const operation = await client.fileSearchStores.uploadToFileSearchStore({
      file: filePath,
      file_search_store_name: storeName,
      config: {
        display_name: displayName,
        chunking_config: options?.chunkingConfig ? {
          white_space_config: {
            max_tokens_per_chunk: options.chunkingConfig.maxTokensPerChunk ?? 512,
            max_overlap_tokens: options.chunkingConfig.maxOverlapTokens ?? 50
          }
        } : undefined,
        custom_metadata: options?.customMetadata
      }
    });

    // Wait for indexing to complete
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      operation = await client.operations.get(operation);
    }

    return {
      documentName: operation.result.name,
      status: 'indexed'
    };
  }

  /**
   * Query the file search store
   */
  async query(
    query: string,
    options?: { metadataFilter?: string }
  ): Promise<{
    answer: string;
    sources: Array<{ title: string; chunk: string }>;
    confidence: number;
  }> {
    const storeName = await this.getOrCreateStore();

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        tools: [{
          file_search: {
            file_search_store_names: [storeName],
            metadata_filter: options?.metadataFilter
          }
        }]
      }
    });

    const grounding = response.candidates?.[0]?.grounding_metadata;
    const sources = grounding?.grounding_chunks?.map(c => ({
      title: c.retrieved_context?.title ?? 'Unknown',
      chunk: c.retrieved_context?.text ?? ''
    })) ?? [];

    return {
      answer: response.text ?? '',
      sources,
      confidence: sources.length > 0 ? 0.9 : 0.3  // High confidence if sources found
    };
  }

  /**
   * Delete a document from the store
   */
  async deleteDocument(documentName: string): Promise<void> {
    await client.fileSearchStores.documents.delete({
      name: documentName,
      config: { force: true }
    });
  }

  /**
   * List all documents in the store
   */
  async listDocuments(): Promise<Array<{ name: string; displayName: string }>> {
    const storeName = await this.getOrCreateStore();
    const docs = await client.fileSearchStores.documents.list({ parent: storeName });
    return docs.map(d => ({ name: d.name, displayName: d.display_name }));
  }
}

export const geminiFileSearchStore = new GeminiFileSearchStore();
```

### 4.2 Update: Upload API Route

Update `/app/api/admin/knowledge-base/upload/route.ts`:

```typescript
// Replace GeminiFileManager with GeminiFileSearchStore
import { geminiFileSearchStore } from '@/lib/gemini-file-search-store';

// In upload handler:
const result = await geminiFileSearchStore.uploadFile(
  tempFilePath,
  file.name,
  {
    chunkingConfig: {
      maxTokensPerChunk: 512,
      maxOverlapTokens: 50
    }
  }
);

// Save to database with new fields
await createKBDocument({
  ...metadata,
  fileSearchDocumentName: result.documentName,
  status: 'active'  // Already indexed
});
```

### 4.3 Update: Knowledge Base Tool

Update `/lib/tools/knowledge-base.ts`:

```typescript
import { geminiFileSearchStore } from '@/lib/gemini-file-search-store';

export const knowledgeBaseTool = tool({
  description: `Search internal Knowledge Base...`,
  
  execute: async ({ query }) => {
    const result = await geminiFileSearchStore.query(query);
    
    if (result.sources.length === 0) {
      return KB_SIGNALS.NOT_FOUND;
    }
    
    if (result.confidence < 0.7) {
      return KB_SIGNALS.LOW_CONFIDENCE;
    }
    
    return result.answer;
  }
});
```

---

## 5. Migration Strategy

### Phase 1: Parallel Implementation (Day 1-2)
- [ ] Create `GeminiFileSearchStore` service
- [ ] Create new File Search Store in Gemini
- [ ] Keep old implementation running

### Phase 2: Data Migration (Day 2-3)
- [ ] Re-upload existing documents to File Search Store
- [ ] Update database records with new references
- [ ] Verify indexing complete

### Phase 3: Switch Over (Day 3-4)
- [ ] Update Upload API to use new service
- [ ] Update KB Tool to use new query method
- [ ] Update Delete API

### Phase 4: Cleanup (Day 4-5)
- [ ] Remove old Files API code
- [ ] Remove old GeminiFileManager (if not needed elsewhere)
- [ ] Update tests

---

## 6. Configuration

### Environment Variables
```env
# Existing
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key

# New (optional)
KB_FILE_SEARCH_STORE_NAME=mylo-knowledge-base
KB_CHUNK_SIZE=512
KB_CHUNK_OVERLAP=50
```

### Chunking Strategy
```typescript
// Recommended for travel documents
const CHUNKING_CONFIG = {
  maxTokensPerChunk: 512,   // Good balance for context
  maxOverlapTokens: 50      // Preserve context between chunks
};
```

---

## 7. Cost Analysis

| Operation | Old API | New File Search API |
|-----------|---------|---------------------|
| File Storage | Temp (48h) | Persistent (free) |
| Indexing | Manual | $0.15 / 1M tokens |
| Query Embedding | Per query | Free |
| Retrieval | N/A | Free |

**Estimated Monthly Cost** (100 docs, 1000 queries):
- Indexing: ~$0.50 (one-time per document)
- Queries: $0.00
- Total: ~$0.50/month

---

## 8. Success Criteria

- [ ] File Search Store created and accessible
- [ ] Documents indexed with < 5 min processing time
- [ ] Query confidence > 0.8 for relevant questions
- [ ] Fallback to web_search only when KB has no relevant info
- [ ] Admin UI shows correct document status
- [ ] Citations available in grounding_metadata

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API not available in region | High | Check Gemini API availability |
| Different response format | Medium | Thorough testing, gradual rollout |
| Cost increase | Low | Monitor usage, set alerts |
| Migration data loss | High | Backup before migration, parallel run |

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-25 | Spec Creator | Initial specification |
