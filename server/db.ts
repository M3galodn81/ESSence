import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../shared/schema';

const sqlite = new Database('ESS.db');

sqlite.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
`);

export const db = drizzle(sqlite, { schema });
export { sql } from 'drizzle-orm';

export { sqlite };

export function closeDb() {
  sqlite.close();
}

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
