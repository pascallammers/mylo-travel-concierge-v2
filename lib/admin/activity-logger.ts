import { db } from '@/lib/db';
import { adminActivityLog, type AdminActivityAction } from '@/lib/db/schema';

/**
 * Log an admin or system action affecting a user account.
 * @param targetUserId - The user being affected
 * @param action - The action type
 * @param performedBy - The admin user ID (null for system/webhook actions)
 * @param details - Additional context about the change
 */
export async function logAdminActivity(
  targetUserId: string,
  action: AdminActivityAction,
  performedBy: string | null,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(adminActivityLog).values({
      targetUserId,
      performedBy,
      action,
      details: details ?? null,
    });
  } catch (error) {
    // Never let logging failures break the main operation
    console.error('[AdminActivityLog] Failed to log activity:', error);
  }
}
