import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../shared/schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

const sqlite = new Database('ESS.db');

sqlite.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
`);

export const db = drizzle(sqlite, { schema });

try {
  const migrationsFolder = path.join(process.cwd(), 'migrations');
  migrate(db, { migrationsFolder });
  console.log('Migrations completed successfully');
} catch (error) {
  console.error('Migration error:', error);
}

export { sql } from 'drizzle-orm';

export { sqlite };

export function closeDb() {
  sqlite.close();
}

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
