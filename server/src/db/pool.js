import pg from 'pg';
import { config } from '../config.js';

// DATE-Spalten als Text 'JJJJ-MM-TT' liefern statt als JavaScript-Date (vermeidet Zeitzonenfehler)
pg.types.setTypeParser(1082, (value) => value);
// count(*) liefert bigint, das als Zahl reicht
pg.types.setTypeParser(20, (value) => Number(value));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.DB_POOL_MAX ?? 10),
});

export function query(text, params) {
  return pool.query(text, params);
}

// Führt mehrere Abfragen als eine Transaktion aus: entweder alles oder nichts wird gespeichert
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
