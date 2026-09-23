import 'server-only';

import { and, eq, gt } from 'drizzle-orm';
import { db } from '../index';
import { awardwalletConnections, loyaltyAccounts } from '../schema';

/**
 * Load the programs where a user has existing miles, without loading account details.
 * @param userId - Authenticated MYLO user ID.
 * @returns Distinct program IDs with positive balances, empty without linked accounts.
 */
export async function getOwnBalanceProgramIds(userId: string): Promise<ReadonlySet<string>> {
  const rows = await db
    .selectDistinct({ programId: loyaltyAccounts.programId })
    .from(loyaltyAccounts)
    .innerJoin(awardwalletConnections, eq(loyaltyAccounts.connectionId, awardwalletConnections.id))
    .where(and(eq(awardwalletConnections.userId, userId), gt(loyaltyAccounts.balance, 0)));

  return new Set(rows.map(({ programId }) => programId));
}
