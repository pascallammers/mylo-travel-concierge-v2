import { db } from '../drizzle';
import { sessionStates, SessionStateData } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Get session state for a chat
 * @param chatId - Chat ID
 * @returns Session state data or empty object
 */
export async function getSessionState(chatId: string): Promise<SessionStateData> {
  const result = await db.query.sessionStates.findFirst({
    where: eq(sessionStates.chatId, chatId),
  });

  return result?.state || {};
}

/**
 * Merge session state with new data
 * @param chatId - Chat ID
 * @param patch - Partial session state to merge
 * @returns Updated session state
 */
export async function mergeSessionState(
  chatId: string,
  patch: Partial<SessionStateData>
): Promise<SessionStateData> {
  const current = await getSessionState(chatId);
  const merged: SessionStateData = { ...current, ...patch };

  await db
    .insert(sessionStates)
    .values({
      chatId,
      state: merged as any,
    })
    .onConflictDoUpdate({
      target: sessionStates.chatId,
      set: {
        state: merged as any,
        updatedAt: new Date(),
      },
    });

  return merged;
}

/**
 * Clear session state for a chat
 * @param chatId - Chat ID
 */
export async function clearSessionState(chatId: string): Promise<void> {
  await db.delete(sessionStates).where(eq(sessionStates.chatId, chatId));
}
