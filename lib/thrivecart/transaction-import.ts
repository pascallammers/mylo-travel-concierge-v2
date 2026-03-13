import { db } from '@/lib/db';
import { thriveCartTransaction, thriveCartImportState } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { searchTransactions, rateLimitDelay } from './client';
import { thrivecartConfig } from './config';
import type { ThriveCartApiTransaction } from './types';
import { generateId } from 'ai';

const PER_PAGE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const MYLO_PRODUCT_ID = thrivecartConfig.productId; // "5"

interface ImportResult {
  totalFetched: number;
  totalInserted: number;
  totalSkipped: number;
  totalPages: number;
  currentPage: number;
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
    transactionType: txn.transaction_type as 'charge' | 'rebill' | 'refund' | 'cancel' | 'failed',
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
    totalPages: 0,
    currentPage: 0,
    errors: [],
  };

  // Update import state to running
  await db
    .update(thriveCartImportState)
    .set({ status: 'running', lastImportAt: new Date(), lastError: null })
    .where(eq(thriveCartImportState.id, 'singleton'));

  try {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      result.currentPage = page;
      console.log(`[TC Import] Fetching page ${page}...`);

      // Retry logic for transient API failures
      let response = await searchTransactions(page, PER_PAGE);
      let retries = 0;
      while (!response.success && retries < MAX_RETRIES) {
        retries++;
        console.warn(`[TC Import] Page ${page} failed, retry ${retries}/${MAX_RETRIES}...`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * retries));
        response = await searchTransactions(page, PER_PAGE);
      }
      await rateLimitDelay();

      if (!response.success || !response.data) {
        result.errors.push(`Page ${page}: ${response.error || 'Unknown error'} (after ${retries} retries)`);
        break;
      }

      const { transactions, meta } = response.data;
      const totalPages = Math.ceil(meta.total / PER_PAGE);
      result.totalPages = totalPages;
      result.totalFetched += transactions.length;

      if (transactions.length === 0) {
        hasMore = false;
        break;
      }

      // Filter to MYLO product only, then insert (skip duplicates)
      const myloTransactions = transactions.filter(
        (txn) => String(txn.base_product) === MYLO_PRODUCT_ID
      );

      for (const txn of myloTransactions) {
        try {
          const row = mapTransaction(txn);
          const inserted = await db
            .insert(thriveCartTransaction)
            .values(row)
            .onConflictDoNothing({ target: thriveCartTransaction.eventId })
            .returning({ id: thriveCartTransaction.id });

          if (inserted.length > 0) {
            result.totalInserted++;
          } else {
            result.totalSkipped++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown';
          if (msg.includes('duplicate') || msg.includes('unique')) {
            result.totalSkipped++;
          } else {
            result.errors.push(`Event ${txn.event_id}: ${msg}`);
          }
        }
      }
      result.totalSkipped += transactions.length - myloTransactions.length;

      // Update progress in DB so frontend can poll it
      await db
        .update(thriveCartImportState)
        .set({
          status: 'running',
          totalImported: result.totalInserted,
          lastError: `Seite ${page}/${totalPages} (${result.totalFetched}/${meta.total} Transaktionen)`,
        })
        .where(eq(thriveCartImportState.id, 'singleton'));

      console.log(
        `[TC Import] Page ${page}/${totalPages}: ${transactions.length} fetched, total so far: ${result.totalFetched}/${meta.total}`
      );

      hasMore = page < totalPages;
      page++;
    }

    // Update import state to idle
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
    totalPages: 0,
    currentPage: 0,
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

      // Filter to MYLO product only
      const myloTransactions = transactions.filter(
        (txn) => String(txn.base_product) === MYLO_PRODUCT_ID
      );
      result.totalSkipped += transactions.length - myloTransactions.length;

      let newInPage = 0;
      for (const txn of myloTransactions) {
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

      // If no new MYLO transactions in this page, older pages won't have new ones either
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
