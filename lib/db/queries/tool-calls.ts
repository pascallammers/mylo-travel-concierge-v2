import { db } from '../drizzle';
import { toolCalls, ToolCallStatus } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Generate SHA256 hash for deduplication
 * @param data - Data to hash
 * @returns Hash string
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Record a new tool call in the database
 * @param params - Tool call parameters
 * @returns Tool call ID and dedupe key
 */
export async function recordToolCall(params: {
  chatId: string;
  toolName: string;
  request: unknown;
}): Promise<{ id: string; dedupeKey: string }> {
  const dedupeKey = await sha256(
    JSON.stringify({
      chatId: params.chatId,
      toolName: params.toolName,
      request: params.request,
    })
  );

  // Check for existing tool call
  const existing = await db.query.toolCalls.findFirst({
    where: eq(toolCalls.dedupeKey, dedupeKey),
    columns: { id: true },
  });

  if (existing) {
    return { id: existing.id, dedupeKey };
  }

  // Insert new tool call
  const [result] = await db
    .insert(toolCalls)
    .values({
      chatId: params.chatId,
      toolName: params.toolName,
      status: 'queued',
      request: params.request as any,
      dedupeKey,
    })
    .returning({ id: toolCalls.id });

  return { id: result.id, dedupeKey };
}

/**
 * Update tool call status and details
 * @param id - Tool call ID
 * @param update - Fields to update
 */
export async function updateToolCall(
  id: string,
  update: {
    status?: ToolCallStatus;
    response?: unknown;
    error?: string;
    startedAt?: Date;
    finishedAt?: Date;
  }
): Promise<void> {
  await db
    .update(toolCalls)
    .set({
      ...(update.status && { status: update.status }),
      ...(update.response && { response: update.response as any }),
      ...(update.error && { error: update.error }),
      ...(update.startedAt && { startedAt: update.startedAt }),
      ...(update.finishedAt && { finishedAt: update.finishedAt }),
    })
    .where(eq(toolCalls.id, id));
}

/**
 * Get tool call by ID
 * @param id - Tool call ID
 * @returns Tool call or undefined
 */
export async function getToolCallById(id: string) {
  return await db.query.toolCalls.findFirst({
    where: eq(toolCalls.id, id),
  });
}
