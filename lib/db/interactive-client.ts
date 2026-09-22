import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

let database: PostgresJsDatabase | undefined;

/**
 * Lazily share the interactive driver used by versioned administrative tables.
 * @returns Cache-free database; no connection is opened until queried.
 */
export function getInteractiveDatabase(): PostgresJsDatabase {
  if (!database) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Die Datenbank ist nicht konfiguriert.');
    database = drizzle(
      postgres(url, { max: 4, prepare: false, fetch_types: false, idle_timeout: 20, connect_timeout: 10 }),
    );
  }
  return database;
}
