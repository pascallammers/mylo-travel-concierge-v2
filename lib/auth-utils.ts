import { auth } from '@/lib/auth';
import { config } from 'dotenv';
import { headers } from 'next/headers';
import { User } from './db/schema';
import { sessionCache, extractSessionToken, createSessionKey } from './performance-cache';
import { db } from './db';
import { user } from './db/schema';
import { eq } from 'drizzle-orm';
import { clearUserDataCache } from './user-data-server';
import { invalidateUserCaches } from './performance-cache';

config({
  path: '.env.local',
});

export type UserRole = 'user' | 'admin';

export const getSession = async () => {
  const requestHeaders = await headers();
  const sessionToken = extractSessionToken(requestHeaders);

  // Try cache first (only if we have a session token)
  if (sessionToken) {
    const cacheKey = createSessionKey(sessionToken);
    const cached = sessionCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  // Only cache valid sessions with users
  if (sessionToken && session?.user) {
    const cacheKey = createSessionKey(sessionToken);
    sessionCache.set(cacheKey, session);
  }

  return session;
};

export const getUser = async (): Promise<User | null> => {
  const session = await getSession();
  return session?.user as User | null;
};

/**
 * Get the role of a user by their ID
 * @param userId - The user's ID
 * @returns The user's role ('user' or 'admin')
 */
export const getUserRole = async (userId: string): Promise<UserRole> => {
  const result = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { role: true },
  });

  return (result?.role as UserRole) || 'user';
};

/**
 * Check if a user has admin role
 * @param userId - The user's ID
 * @returns True if user is an admin, false otherwise
 */
export const isAdmin = async (userId: string): Promise<boolean> => {
  const role = await getUserRole(userId);
  return role === 'admin';
};

/**
 * Update a user's role
 * @param userId - The user's ID
 * @param newRole - The new role to assign
 * @returns The updated user
 */
export const updateUserRole = async (userId: string, newRole: UserRole): Promise<User> => {
  const [updatedUser] = await db
    .update(user)
    .set({ role: newRole, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning();

  if (!updatedUser) {
    throw new Error(`User with ID ${userId} not found`);
  }

  // Invalidate caches when role changes
  invalidateUserCaches(userId);
  clearUserDataCache(userId);

  return updatedUser as User;
};

/**
 * Check if the current session user is an admin
 * @returns True if current user is admin, false otherwise
 */
export const isCurrentUserAdmin = async (): Promise<boolean> => {
  const currentUser = await getUser();
  if (!currentUser) {
    return false;
  }
  return isAdmin(currentUser.id);
};

/** E-mail addresses allowed to access the Business KPI dashboard. */
const KPI_AUTHORIZED_EMAILS = [
  'tayler.schweigert@lovelifepassport.com',
  'pascal.lammers@stay-digital.de',
] as const;

/**
 * Check if the current user is authorized to access Business KPIs.
 * Only specific email addresses are allowed, even among admins.
 * @returns True if the user may access KPI data
 */
export const isKpiAuthorized = async (): Promise<boolean> => {
  const currentUser = await getUser();
  if (!currentUser?.email) return false;
  return KPI_AUTHORIZED_EMAILS.includes(
    currentUser.email.toLowerCase() as (typeof KPI_AUTHORIZED_EMAILS)[number],
  );
};
