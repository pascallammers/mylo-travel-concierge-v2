type SessionUser = { id: string } | null | undefined;
type AccessResult = { ok: true } | { ok: false; reason: 'unauthenticated' | 'not_found' | 'forbidden' };

/**
 * Decide ownership using only trusted session and resource data.
 * @param input - The session user and the resource loaded on the server.
 * @returns A discriminated decision; callers expose a uniform failure for denied resources.
 */
export function checkChatAccess({
  user,
  chat,
}: {
  user: SessionUser;
  chat: { userId: string } | null | undefined;
}): AccessResult {
  if (!user) return { ok: false, reason: 'unauthenticated' };
  if (!chat) return { ok: false, reason: 'not_found' };
  if (chat.userId !== user.id) return { ok: false, reason: 'forbidden' };
  return { ok: true };
}

/**
 * Authenticate an admin route before reading input or accessing protected services.
 * @param dependencies - Session resolution and the existing persisted role lookup.
 * @returns A 401/403 response when denied, otherwise null.
 */
export async function getAdminAuthError(dependencies: {
  getUser: () => Promise<SessionUser>;
  getUserRole: (userId: string) => Promise<string>;
}): Promise<Response | null> {
  const user = await dependencies.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if ((await dependencies.getUserRole(user.id)) !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
