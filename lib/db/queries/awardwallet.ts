import 'server-only';

import { and, desc, eq } from 'drizzle-orm';
import { db } from '../index';
import {
  awardwalletConnections,
  loyaltyAccounts,
  type AwardWalletConnection,
  type AwardWalletConnectionStatus,
  type LoyaltyAccount,
} from '../schema';
import { ChatSDKError } from '@/lib/errors';
import type { AWLoyaltyAccount } from '@/lib/api/awardwallet-client';

export type { AwardWalletConnection, LoyaltyAccount };

/**
 * Combined user loyalty data for UI display
 */
export interface UserLoyaltyData {
  connected: boolean;
  lastSyncedAt: Date | null;
  accounts: LoyaltyAccount[];
}

/**
 * Creates a new AwardWallet connection for a user
 * @param userId - MYLO user ID
 * @param awUserId - AwardWallet user ID
 * @returns The created connection
 */
export async function createConnection(
  userId: string,
  awUserId: string,
): Promise<AwardWalletConnection> {
  try {
    const [connection] = await db
      .insert(awardwalletConnections)
      .values({
        userId,
        awUserId,
        status: 'connected',
      })
      .returning();

    console.log('[AwardWallet] Connection created for user:', userId);
    return connection;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('unique constraint')) {
      throw new ChatSDKError('bad_request:api', 'User already has an AwardWallet connection');
    }
    throw new ChatSDKError('bad_request:database', 'Failed to create AwardWallet connection');
  }
}

/**
 * Gets a user's AwardWallet connection
 * @param userId - MYLO user ID
 * @returns The connection or null if not found
 */
export async function getConnection(userId: string): Promise<AwardWalletConnection | null> {
  try {
    const [connection] = await db
      .select()
      .from(awardwalletConnections)
      .where(eq(awardwalletConnections.userId, userId))
      .$withCache();

    return connection ?? null;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get AwardWallet connection');
  }
}

/**
 * Updates the status of an AwardWallet connection
 * @param id - Connection ID
 * @param status - New status
 * @param errorMessage - Optional error message
 * @returns The updated connection or null
 */
export async function updateConnectionStatus(
  id: string,
  status: AwardWalletConnectionStatus,
  errorMessage?: string,
): Promise<AwardWalletConnection | null> {
  try {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }

    if (status === 'connected') {
      updateData.errorMessage = null;
    }

    const [updated] = await db
      .update(awardwalletConnections)
      .set(updateData)
      .where(eq(awardwalletConnections.id, id))
      .returning();

    return updated ?? null;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to update connection status');
  }
}

/**
 * Deletes a user's AwardWallet connection and all associated loyalty accounts
 * @param userId - MYLO user ID
 * @returns true if deleted, false if not found
 */
export async function deleteConnection(userId: string): Promise<boolean> {
  try {
    const result = await db
      .delete(awardwalletConnections)
      .where(eq(awardwalletConnections.userId, userId))
      .returning({ id: awardwalletConnections.id });

    const deleted = result.length > 0;
    if (deleted) {
      console.log('[AwardWallet] Connection deleted for user:', userId);
    }
    return deleted;
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to delete AwardWallet connection');
  }
}

/**
 * Gets all loyalty accounts for a connection, sorted by balance
 * @param connectionId - Connection ID
 * @returns Array of loyalty accounts sorted by balance DESC
 */
export async function getLoyaltyAccounts(connectionId: string): Promise<LoyaltyAccount[]> {
  try {
    return await db
      .select()
      .from(loyaltyAccounts)
      .where(eq(loyaltyAccounts.connectionId, connectionId))
      .orderBy(desc(loyaltyAccounts.balance))
      .$withCache();
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get loyalty accounts');
  }
}

/**
 * Syncs loyalty accounts for a connection (upsert pattern)
 * @param connectionId - Connection ID
 * @param accounts - Array of accounts from AwardWallet API
 * @returns Number of accounts synced
 */
export async function syncLoyaltyAccounts(
  connectionId: string,
  accounts: AWLoyaltyAccount[],
): Promise<number> {
  try {
    await db.transaction(async (tx) => {
      // Delete existing accounts for this connection
      await tx.delete(loyaltyAccounts).where(eq(loyaltyAccounts.connectionId, connectionId));

      // Insert new accounts
      if (accounts.length > 0) {
        await tx.insert(loyaltyAccounts).values(
          accounts.map((acc) => ({
            connectionId,
            providerCode: acc.providerCode,
            providerName: acc.providerName,
            balance: acc.balance,
            balanceUnit: acc.balanceUnit,
            eliteStatus: acc.eliteStatus,
            expirationDate: acc.expirationDate,
            accountNumber: acc.accountNumber,
            logoUrl: acc.logoUrl,
          })),
        );
      }

      // Update lastSyncedAt on connection
      await tx
        .update(awardwalletConnections)
        .set({
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(awardwalletConnections.id, connectionId));
    });

    console.log(`[AwardWallet] Synced ${accounts.length} accounts for connection:`, connectionId);
    return accounts.length;
  } catch (error: unknown) {
    const invalidBalances = accounts.filter((acc) => !Number.isFinite(acc.balance));
    const oversizedBalances = accounts.filter((acc) => acc.balance > 2_147_483_647);
    const missingProviders = accounts.filter((acc) => !acc.providerCode || !acc.providerName);

    if (invalidBalances.length || oversizedBalances.length || missingProviders.length) {
      console.error('[AwardWallet] Sync validation issues', {
        connectionId,
        accountCount: accounts.length,
        invalidBalances: invalidBalances.slice(0, 3).map((acc) => ({
          providerCode: acc.providerCode,
          providerName: acc.providerName,
          balance: acc.balance,
          balanceUnit: acc.balanceUnit,
        })),
        oversizedBalances: oversizedBalances.slice(0, 3).map((acc) => ({
          providerCode: acc.providerCode,
          providerName: acc.providerName,
          balance: acc.balance,
          balanceUnit: acc.balanceUnit,
        })),
        missingProviders: missingProviders.slice(0, 3).map((acc) => ({
          providerCode: acc.providerCode,
          providerName: acc.providerName,
        })),
      });
    }

    if (error instanceof Error) {
      console.error('[AwardWallet] Sync DB error:', error.message);
    } else {
      console.error('[AwardWallet] Sync DB error:', error);
    }

    throw new ChatSDKError('bad_request:database', 'Failed to sync loyalty accounts');
  }
}

/**
 * Gets combined loyalty data for a user (for UI display)
 * @param userId - MYLO user ID
 * @returns Combined connection and accounts data
 */
export async function getUserLoyaltyData(userId: string): Promise<UserLoyaltyData> {
  try {
    const connection = await getConnection(userId);

    if (!connection || connection.status !== 'connected') {
      return {
        connected: false,
        lastSyncedAt: null,
        accounts: [],
      };
    }

    const accounts = await getLoyaltyAccounts(connection.id);

    return {
      connected: true,
      lastSyncedAt: connection.lastSyncedAt,
      accounts,
    };
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get user loyalty data');
  }
}

/**
 * Gets all active connections for cron sync
 * @returns Array of active connections
 */
export async function getActiveConnections(): Promise<AwardWalletConnection[]> {
  try {
    return await db
      .select()
      .from(awardwalletConnections)
      .where(eq(awardwalletConnections.status, 'connected'));
  } catch {
    throw new ChatSDKError('bad_request:database', 'Failed to get active connections');
  }
}
