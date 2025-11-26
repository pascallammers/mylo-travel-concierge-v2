#!/usr/bin/env tsx
/**
 * Knowledge Base Migration Script
 * 
 * Migrates existing KB documents from the legacy Gemini Files API
 * to the new File Search Stores API for improved RAG querying.
 * 
 * @module migrate-kb-to-file-search-store
 * 
 * @note This script requires running in a server context. Use the provided
 * npm script or run with: npm run migrate:kb -- --dry-run
 */

import { geminiFileSearchStore } from '@/lib/gemini-file-search-store';
import { 
  getActiveKBDocuments, 
  updateKBDocument,
  type KBDocument 
} from '@/lib/db/queries/kb-documents';
import { GeminiFileManager } from '@/lib/gemini-file-manager';
import { writeFile, unlink, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

// ============================================================================
// Types & Configuration
// ============================================================================

/** Configuration options for the migration script. */
interface MigrationConfig {
  /** If true, only log what would be done without making changes. */
  dryRun: boolean;
  /** If true, continue processing after errors instead of stopping. */
  continueOnError: boolean;
  /** Number of documents to process in each batch. */
  batchSize: number;
  /** Delay in milliseconds between batches to avoid rate limits. */
  delayBetweenBatches: number;
  /** Directory to store temporarily downloaded files. */
  tempDir: string;
}

/** Result of a migration attempt for a single document. */
interface DocumentMigrationResult {
  documentId: string;
  fileName: string;
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  error?: string;
}

/** Overall migration summary. */
interface MigrationSummary {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

// ============================================================================
// Core Migration Logic
// ============================================================================

/**
 * Checks if a document needs migration.
 * @param doc - The KB document to check
 * @returns True if migration is needed, false otherwise
 */
function needsMigration(doc: KBDocument): boolean {
  return (
    !doc.fileSearchDocumentName && // Not yet migrated
    !!doc.geminiFileName && // Has old Gemini file reference
    doc.status === 'active' && // Is active
    !doc.deletedAt // Not deleted
  );
}

/**
 * Attempts to download a file from Gemini's legacy Files API.
 * 
 * NOTE: The Gemini Files API does not provide a direct download method.
 * This function is a placeholder that will fail for documents that only
 * exist in Gemini's storage. See migration guide for workarounds.
 * 
 * @param geminiFileName - The Gemini file name (e.g., "files/abc123")
 * @param tempDir - Directory to save the downloaded file
 * @returns Path to the downloaded file
 * @throws Error if download fails or is not supported
 */
async function downloadGeminiFile(
  geminiFileName: string,
  tempDir: string
): Promise<string> {
  // The Gemini Files API does not provide a download endpoint
  // This is a known limitation that must be handled in the migration guide
  throw new Error(
    'Gemini Files API does not support downloading files. ' +
    'Original file must be available locally or re-uploaded.'
  );
}

/**
 * Migrates a single KB document to the File Search Store.
 * @param doc - The document to migrate
 * @param config - Migration configuration
 * @returns Result of the migration attempt
 */
async function migrateDocument(
  doc: KBDocument,
  config: MigrationConfig
): Promise<DocumentMigrationResult> {
  const { tempDir, dryRun } = config;

  try {
    // Skip if already migrated
    if (!needsMigration(doc)) {
      return {
        documentId: doc.id,
        fileName: doc.displayName,
        status: 'skipped',
        reason: 'Already migrated or invalid status',
      };
    }

    if (dryRun) {
      console.log(`[DRY RUN] Would migrate document ${doc.id}: ${doc.displayName}`);
      return {
        documentId: doc.id,
        fileName: doc.displayName,
        status: 'skipped',
        reason: 'Dry run mode',
      };
    }

    // CRITICAL LIMITATION: Original files are not stored locally
    // They were temporarily saved to /tmp during upload and then deleted
    // We cannot download them from Gemini's Files API
    
    console.log(`[Migration] Document ${doc.id} cannot be automatically migrated`);
    console.log(`[Migration] Reason: Original file not available locally`);
    console.log(`[Migration] Gemini Files API does not support file downloads`);
    
    return {
      documentId: doc.id,
      fileName: doc.displayName,
      status: 'skipped',
      reason: 'Original file not available - requires manual re-upload',
    };

    // CODE BELOW IS UNREACHABLE but kept for reference if download becomes possible
    // 
    // const tempFilePath = join(tempDir, `kb-migration-${Date.now()}-${doc.originalFileName}`);
    // 
    // try {
    //   // Download file from Gemini (not currently supported)
    //   const filePath = await downloadGeminiFile(doc.geminiFileName, tempDir);
    //   
    //   // Upload to File Search Store
    //   const uploadResult = await geminiFileSearchStore.uploadFile(
    //     filePath,
    //     doc.displayName,
    //     {
    //       chunkingConfig: {
    //         maxTokensPerChunk: 512,
    //         maxOverlapTokens: 50,
    //       },
    //     }
    //   );
    //   
    //   // Update database with new references
    //   await updateKBDocument(doc.id, {
    //     fileSearchDocumentName: uploadResult.documentName,
    //     fileSearchStoreName: uploadResult.storeName,
    //     fileSearchIndexedAt: new Date(),
    //   });
    //   
    //   return {
    //     documentId: doc.id,
    //     fileName: doc.displayName,
    //     status: 'success',
    //   };
    // } finally {
    //   // Clean up temp file
    //   await unlink(tempFilePath).catch(() => {
    //     // Ignore cleanup errors
    //   });
    // }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Migration] Failed to migrate document ${doc.id}:`, errorMessage);
    
    return {
      documentId: doc.id,
      fileName: doc.displayName,
      status: 'failed',
      error: errorMessage,
    };
  }
}

/**
 * Processes a batch of documents.
 * @param documents - Documents to process
 * @param config - Migration configuration
 * @returns Array of migration results
 */
async function processBatch(
  documents: KBDocument[],
  config: MigrationConfig
): Promise<DocumentMigrationResult[]> {
  const results: DocumentMigrationResult[] = [];
  
  for (const doc of documents) {
    const result = await migrateDocument(doc, config);
    results.push(result);
  }
  
  return results;
}

/**
 * Main migration function that orchestrates the entire process.
 * @param config - Migration configuration
 * @returns Migration summary with statistics
 */
async function migrateDocuments(config: MigrationConfig): Promise<MigrationSummary> {
  console.log('=== Knowledge Base Migration to File Search Store ===\n');
  console.log('Configuration:', JSON.stringify(config, null, 2), '\n');
  
  // Step 1: Fetch all active documents
  console.log('[1/4] Fetching active documents from database...');
  const allDocuments = await getActiveKBDocuments();
  console.log(`Found ${allDocuments.length} active documents\n`);
  
  // Step 2: Filter documents that need migration
  console.log('[2/4] Filtering documents that need migration...');
  const documentsToMigrate = allDocuments.filter(needsMigration);
  console.log(`${documentsToMigrate.length} documents need migration\n`);
  
  if (documentsToMigrate.length === 0) {
    console.log('✓ All documents are already migrated or no documents found.\n');
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
  }
  
  if (config.dryRun) {
    console.log('*** DRY RUN MODE - No changes will be made ***\n');
    console.log('Documents that would be migrated:');
    documentsToMigrate.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. ${doc.displayName} (ID: ${doc.id})`);
    });
    console.log('');
    
    return {
      total: documentsToMigrate.length,
      success: 0,
      failed: 0,
      skipped: documentsToMigrate.length,
      errors: [],
    };
  }
  
  // Step 3: Process in batches
  console.log('[3/4] Processing documents in batches...');
  const results: DocumentMigrationResult[] = [];
  
  for (let i = 0; i < documentsToMigrate.length; i += config.batchSize) {
    const batch = documentsToMigrate.slice(i, i + config.batchSize);
    const batchNum = Math.floor(i / config.batchSize) + 1;
    const totalBatches = Math.ceil(documentsToMigrate.length / config.batchSize);
    
    console.log(`\nProcessing batch ${batchNum}/${totalBatches} (${batch.length} documents)...`);
    
    const batchResults = await processBatch(batch, config);
    results.push(...batchResults);
    
    // Show batch summary
    const batchSuccess = batchResults.filter(r => r.status === 'success').length;
    const batchFailed = batchResults.filter(r => r.status === 'failed').length;
    const batchSkipped = batchResults.filter(r => r.status === 'skipped').length;
    console.log(`Batch ${batchNum} complete: ${batchSuccess} success, ${batchFailed} failed, ${batchSkipped} skipped`);
    
    // Check if we should stop on error
    if (batchFailed > 0 && !config.continueOnError) {
      console.error('\n❌ Migration stopped due to errors (use --continue-on-error to proceed)');
      break;
    }
    
    // Delay between batches (except for last batch)
    if (i + config.batchSize < documentsToMigrate.length) {
      console.log(`Waiting ${config.delayBetweenBatches}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenBatches));
    }
  }
  
  // Step 4: Generate summary
  console.log('\n[4/4] Generating summary...\n');
  
  const summary: MigrationSummary = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    errors: results
      .filter(r => r.status === 'failed' && r.error)
      .map(r => ({ id: r.documentId, error: r.error! })),
  };
  
  return summary;
}

/**
 * Prints the migration summary to console.
 * @param summary - Migration summary to display
 */
function printSummary(summary: MigrationSummary): void {
  console.log('='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Documents:     ${summary.total}`);
  console.log(`✓ Successfully Migrated: ${summary.success}`);
  console.log(`⊘ Skipped:           ${summary.skipped}`);
  console.log(`✗ Failed:            ${summary.failed}`);
  console.log('='.repeat(60));
  
  if (summary.errors.length > 0) {
    console.log('\nERROR DETAILS:');
    console.log('-'.repeat(60));
    summary.errors.forEach((err, idx) => {
      console.log(`${idx + 1}. Document ID: ${err.id}`);
      console.log(`   Error: ${err.error}`);
    });
    console.log('-'.repeat(60));
  }
  
  console.log('');
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Main entry point for the CLI script.
 * Parses command-line arguments and executes migration.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  const config: MigrationConfig = {
    dryRun: args.includes('--dry-run'),
    continueOnError: args.includes('--continue-on-error'),
    batchSize: 5,
    delayBetweenBatches: 2000,
    tempDir: '/tmp',
  };
  
  try {
    const summary = await migrateDocuments(config);
    printSummary(summary);
    
    // Exit with error code if any failures
    const exitCode = summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Migration failed with fatal error:', error);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}

// Export for testing
export { migrateDocuments, needsMigration };
