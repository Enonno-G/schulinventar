import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from './pool.js';

const MIGRATIONS_DIR = path.join(import.meta.dirname, 'migrations');
const LOCK_ID = 727001; // verhindert, dass zwei Server gleichzeitig migrieren

// Führt alle noch nicht angewendeten SQL-Dateien aus migrations/ in alphabetischer Reihenfolge aus.
// Neue Änderungen am Schema immer als neue Datei anlegen (002_..., 003_...), nie alte Dateien ändern.
export async function migrate({ log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        log(`Migration angewendet: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} fehlgeschlagen: ${err.message}`, { cause: err });
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    client.release();
  }
}

// Direkter Aufruf über "npm run db:migrate"
if (process.argv[1] === import.meta.filename) {
  try {
    await migrate();
  } finally {
    await pool.end();
  }
}
