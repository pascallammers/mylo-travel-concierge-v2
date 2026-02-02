import 'server-only';

import { db } from '@/lib/db';
import { failedSearchLogs } from '@/lib/db/schema';
import { desc, lt, and, gte, lte, or, ilike } from 'drizzle-orm';

export interface LogFailedSearchParams {
  chatId: string;
  userId: string;
  queryText: string;
  extractedOrigin?: string;
  extractedDestination?: string;
  departDate?: string;
  returnDate?: string;
  cabin?: string;
  resultCount: number;
  errorType?: string;
  errorMessage?: string;
}

/**
 * Log a failed search to the database for monitoring and pattern analysis.
 * @param params - Failed search details
 * @returns The created log entry
 */
export async function logFailedSearch(params: LogFailedSearchParams) {
  return db.insert(failedSearchLogs).values(params).returning();
}

export interface GetFailedSearchLogsParams {
  startDate?: Date;
  endDate?: Date;
  query?: string;
  limit?: number;
}

/**
 * Retrieve failed search logs with optional filtering.
 * @param params - Filter parameters (date range, text query, limit)
 * @returns List of failed search logs
 */
export async function getFailedSearchLogs(params: GetFailedSearchLogsParams = {}) {
  const { startDate, endDate, query, limit = 100 } = params;

  const conditions = [];

  if (startDate) {
    conditions.push(gte(failedSearchLogs.timestamp, startDate));
  }
  if (endDate) {
    conditions.push(lte(failedSearchLogs.timestamp, endDate));
  }
  if (query) {
    conditions.push(
      or(
        ilike(failedSearchLogs.queryText, `%${query}%`),
        ilike(failedSearchLogs.extractedOrigin, `%${query}%`),
        ilike(failedSearchLogs.extractedDestination, `%${query}%`)
      )
    );
  }

  return db
    .select()
    .from(failedSearchLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(failedSearchLogs.timestamp))
    .limit(limit);
}

/**
 * Delete expired failed search logs (older than 30 days).
 * Called by the cleanup cron job.
 * @returns List of deleted log IDs
 */
export async function deleteExpiredLogs() {
  return db
    .delete(failedSearchLogs)
    .where(lt(failedSearchLogs.expiresAt, new Date()))
    .returning({ id: failedSearchLogs.id });
}
