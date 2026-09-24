'use server';

import { getUser } from '@/lib/auth-utils';
import { checkChatAccess } from '@/lib/auth-guards';
import {
  getChatById,
  getChatsByUserId,
  deleteChatById,
  updateChatVisibilityById,
  updateChatTitleById,
  getMessageById,
  deleteMessagesByChatIdAfterTimestamp,
} from '@/lib/db/queries';

function validLimit(limit: number): boolean {
  return Number.isInteger(limit) && limit > 0 && limit <= 100;
}

/**
 * List only the session user's chats, including ownership validation for cursors.
 * @param limit - Maximum number of chats, from 1 to 100.
 * @param startingAfter - Optional cursor for newer chats owned by this user.
 * @param endingBefore - Optional cursor for older chats owned by this user.
 * @returns The user's page, or an empty page on failure.
 */
export async function getUserChats(limit = 20, startingAfter?: string, endingBefore?: string) {
  const empty = { chats: [], hasMore: false };
  const user = await getUser();
  if (!user || !validLimit(limit)) return empty;

  try {
    for (const cursor of [startingAfter, endingBefore]) {
      if (cursor !== undefined) {
        if (typeof cursor !== 'string' || !cursor) return empty;
        const chat = await getChatById({ id: cursor });
        if (!checkChatAccess({ user, chat }).ok) return empty;
      }
    }
    return await getChatsByUserId({
      id: user.id,
      limit,
      startingAfter: startingAfter ?? null,
      endingBefore: endingBefore ?? null,
    });
  } catch (error) {
    console.error('Error fetching user chats:', error);
    return empty;
  }
}

/**
 * Load an older page for the session user.
 * @param lastChatId - Cursor chat owned by the session user.
 * @param limit - Maximum page size.
 * @returns The user's page, or an empty page on failure.
 */
export async function loadMoreChats(lastChatId: string, limit = 20) {
  return getUserChats(limit, undefined, lastChatId);
}

/**
 * Delete a chat only after checking its owner.
 * @param chatId - Target chat identifier.
 * @returns The deleted chat, or null for any failure.
 */
export async function deleteChat(chatId: string) {
  try {
    const user = await getUser();
    if (!user || !chatId) return null;
    const chat = await getChatById({ id: chatId });
    if (!checkChatAccess({ user, chat }).ok) return null;
    return await deleteChatById({ id: chatId });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return null;
  }
}

/**
 * Change visibility only for a chat owned by the session user.
 * @param chatId - Target chat identifier.
 * @param visibility - The new visibility.
 * @returns A serializable result; denied resources throw the same plain error.
 */
export async function updateChatVisibility(chatId: string, visibility: 'private' | 'public') {
  const user = await getUser();
  if (!user || !chatId) throw new Error('Unauthorized');
  const chat = await getChatById({ id: chatId });
  if (!checkChatAccess({ user, chat }).ok) throw new Error('Unauthorized');
  if (visibility !== 'private' && visibility !== 'public') throw new Error('Invalid visibility');
  const result = await updateChatVisibilityById({ chatId, visibility });
  return { success: true, chatId, visibility, rowCount: result?.rowCount || 0 };
}

/**
 * Delete trailing messages only after resolving their chat and checking ownership.
 * @param input - The message identifying where truncation starts.
 * @returns Nothing on success; denied or missing resources throw the same plain error.
 */
export async function deleteTrailingMessages({ id }: { id: string }) {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  const [message] = await getMessageById({ id });
  if (!message) throw new Error('Unauthorized');
  const chat = await getChatById({ id: message.chatId });
  if (!checkChatAccess({ user, chat }).ok) throw new Error('Unauthorized');
  await deleteMessagesByChatIdAfterTimestamp({ chatId: message.chatId, timestamp: message.createdAt });
}

/**
 * Rename only a chat owned by the session user.
 * @param chatId - Target chat identifier.
 * @param title - New nonempty title.
 * @returns The updated chat, or null for any failure.
 */
export async function updateChatTitle(chatId: string, title: string) {
  try {
    const user = await getUser();
    if (!user || !chatId || typeof title !== 'string' || !title.trim()) return null;
    const chat = await getChatById({ id: chatId });
    if (!checkChatAccess({ user, chat }).ok) return null;
    return await updateChatTitleById({ chatId, title: title.trim() });
  } catch (error) {
    console.error('Error updating chat title:', error);
    return null;
  }
}
