import { db } from '@/lib/db';
import { thriveCartTransaction, thriveCartImportState } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { searchTransactions, rateLimitDelay } from './client';
import type { ThriveCartApiTransaction } from './types';
import { generateId } from 'ai';

const PER_PAGE = 100;

interface ImportResult {
  totalFetched: number;
  totalInserted: number;
  totalSkipped: number;
  errors: string[];
}

/**
 * Map a ThriveCart API transaction to a database insert row.
 */
function mapTransaction(txn: ThriveCartApiTransaction) {
  return {
    id: generateId(),
    eventId: String(txn.event_id),
    baseProduct: txn.base_product ? String(txn.base_product) : null,
    transactionDate: new Date(txn.time || txn.date),
    transactionType: txn.transaction_type as 'charge' | 'rebill' | 'refund' | 'cancel',
    itemType: txn.item_type || null,
    itemId: txn.item_id ? String(txn.item_id) : null,
    amount: txn.amount,
    currency: txn.currency?.toUpperCase() || 'EUR',
    orderId: txn.order_id ? String(txn.order_id) : null,
    invoiceId: txn.invoice_id ? String(txn.invoice_id) : null,
    processor: txn.processor || null,
    customerName: txn.customer?.name || null,
    customerEmail: txn.customer?.email?.toLowerCase() || 'unknown',
    reference: txn.reference || null,
    rawData: txn as unknown as Record<string, unknown>,
    importedAt: new Date(),
  };
}

/**
 * Run a full import of ALL transactions from ThriveCart.
 * Fetches all pages and inserts them into the database.
 * Skips duplicates using the unique event_id constraint.
 */
export async function runFullTransactionImport(): Promise<ImportResult> {
  const result: ImportResult = {
    totalFetched: 0,
    totalInserted: 0,
    totalSkipped: 0,
    errors: [],
  };

  // Update import state to running
  await db
    .update(thriveCartImportState)
    .set({ status: 'running', lastImportAt: new Date() })
    .where(eq(thriveCartImportState.id, 'singleton'));

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`[TC Import] Fetching page ${page}...`);
      const response = await searchTransactions(page, PER_PAGE);
      await rateLimitDelay();

      if (!response.success || !response.data) {
        result.errors.push(`Page ${page}: ${response.error || 'Unknown error'}`);
        break;
      }

      const { transactions, meta } = response.data;
      result.totalFetched += transactions.length;

      if (transactions.length === 0) {
        hasMore = false;
        break;
      }

      // Insert batch, skip duplicates
      for (const txn of transactions) {
        try {
          const row = mapTransaction(txn);
          await db
            .insert(thriveCartTransaction)
            .values(row)
            .onConflictDoNothing({ target: thriveCartTransaction.eventId });
          result.totalInserted++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown';
          if (msg.includes('duplicate') || msg.includes('unique')) {
            result.totalSkipped++;
          } else {
            result.errors.push(`Event ${txn.event_id}: ${msg}`);
          }
        }
      }

      console.log(
        `[TC Import] Page ${page}: ${transactions.length} fetched, total so far: ${result.totalFetched}/${meta.total}`
      );

      // Check if we have more pages
      const totalPages = Math.ceil(meta.total / PER_PAGE);
      hasMore = page < totalPages;
      page++;
    }

    // Update import state
    await db
      .update(thriveCartImportState)
      .set({
        status: 'idle',
        lastImportAt: new Date(),
        totalImported: result.totalInserted,
        lastError: result.errors.length > 0 ? result.errors.join('; ') : null,
      })
      .where(eq(thriveCartImportState.id, 'singleton'));

    console.log(
      `[TC Import] Complete: ${result.totalFetched} fetched, ${result.totalInserted} inserted, ${result.totalSkipped} skipped`
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await db
      .update(thriveCartImportState)
      .set({ status: 'failed', lastError: msg })
      .where(eq(thriveCartImportState.id, 'singleton'));
    result.errors.push(msg);
  }

  return result;
}

/**
 * Incremental sync: fetch recent transactions (last few pages)
 * and insert any new ones. Designed to run daily via cron.
 */
export async function runIncrementalSync(): Promise<ImportResult> {
  const result: ImportResult = {
    totalFetched: 0,
    totalInserted: 0,
    totalSkipped: 0,
    errors: [],
  };

  try {
    // Fetch the first 3 pages (most recent 300 transactions)
    // This covers daily volume with margin
    const MAX_PAGES = 3;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await searchTransactions(page, PER_PAGE);
      await rateLimitDelay();

      if (!response.success || !response.data) {
        result.errors.push(`Page ${page}: ${response.error || 'Unknown error'}`);
        break;
      }

      const { transactions } = response.data;
      result.totalFetched += transactions.length;

      if (transactions.length === 0) break;

      let newInPage = 0;
      for (const txn of transactions) {
        try {
          const row = mapTransaction(txn);
          const inserted = await db
            .insert(thriveCartTransaction)
            .values(row)
            .onConflictDoNothing({ target: thriveCartTransaction.eventId })
            .returning({ id: thriveCartTransaction.id });

          if (inserted.length > 0) {
            result.totalInserted++;
            newInPage++;
          } else {
            result.totalSkipped++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown';
          result.totalSkipped++;
          if (!msg.includes('duplicate') && !msg.includes('unique')) {
            result.errors.push(`Event ${txn.event_id}: ${msg}`);
          }
        }
      }

      // If no new transactions in this page, older pages won't have new ones either
      if (newInPage === 0) break;
    }

    // Update import state
    await db
      .update(thriveCartImportState)
      .set({
        lastImportAt: new Date(),
        totalImported: result.totalInserted,
        lastError: result.errors.length > 0 ? result.errors.join('; ') : null,
      })
      .where(eq(thriveCartImportState.id, 'singleton'));

    console.log(
      `[TC Sync] Incremental: ${result.totalFetched} fetched, ${result.totalInserted} new, ${result.totalSkipped} existing`
    );
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}
