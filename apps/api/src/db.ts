import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data/auth.db');
const migrationsDir = path.resolve(process.cwd(), 'src/migrations');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db: BetterSqlite3.Database = new BetterSqlite3(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`);

const appliedRows = db.prepare('SELECT name FROM schema_migrations ORDER BY name').all() as Array<{
  name: string;
}>;

const applied = new Set(appliedRows.map((row) => row.name));

if (fs.existsSync(migrationsDir)) {
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)'
  );

  for (const fileName of migrationFiles) {
    if (applied.has(fileName)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(fileName, new Date().toISOString());
    });

    tx();
  }
}
