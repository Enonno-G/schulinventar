// Verbindung zur Datenbank (PostgreSQL) und Hilfsfunktionen für Abfragen.
//
// So wird es benutzt:
//   const raeume = await db.alle('SELECT * FROM raeume ORDER BY nummer');       -> Liste von Zeilen
//   const raum = await db.eine('SELECT * FROM raeume WHERE id = $1', [raumId]);  -> eine Zeile (oder undefined)
//   await db.ausfuehren('DELETE FROM raeume WHERE id = $1', [raumId]);           -> nichts zurück
//
// $1, $2, … sind Platzhalter. Die echten Werte stehen in der Liste dahinter und werden getrennt an die
// Datenbank geschickt. Dadurch kann niemand über ein Eingabefeld eigenes SQL einschleusen (SQL-Injection).
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { einstellungen } from './einstellungen.js';

// Datumsspalten als Text 'JJJJ-MM-TT' statt als JavaScript-Datum (vermeidet Fehler durch Zeitzonen)
pg.types.setTypeParser(1082, (wert) => wert);
// Ergebnisse von count(*) als normale Zahl
pg.types.setTypeParser(20, (wert) => Number(wert));

export const pool = new pg.Pool({ connectionString: einstellungen.datenbankAdresse });

function abfragen(verbindung) {
  return {
    async alle(sql, werte = []) {
      const ergebnis = await verbindung.query(sql, werte);
      return ergebnis.rows;
    },
    async eine(sql, werte = []) {
      const ergebnis = await verbindung.query(sql, werte);
      return ergebnis.rows[0];
    },
    async ausfuehren(sql, werte = []) {
      await verbindung.query(sql, werte);
    },
  };
}

export const db = {
  ...abfragen(pool),

  // Mehrere Schritte, die nur gemeinsam gespeichert werden („alles oder nichts“).
  // Geht ein Schritt schief, wird alles rückgängig gemacht.
  //   await db.transaktion(async (t) => { await t.ausfuehren(…); await t.ausfuehren(…); });
  async transaktion(schritte) {
    const verbindung = await pool.connect();
    try {
      await verbindung.query('BEGIN');
      const ergebnis = await schritte(abfragen(verbindung));
      await verbindung.query('COMMIT');
      return ergebnis;
    } catch (fehler) {
      await verbindung.query('ROLLBACK');
      throw fehler;
    } finally {
      verbindung.release();
    }
  },
};

// Baut die Tabellen auf: Jede .sql-Datei im Ordner datenbank/ wird der Reihe nach genau einmal ausgeführt.
// Welche schon ausgeführt wurden, merkt sich die Tabelle ausgefuehrte_sql_dateien.
const SQL_ORDNER = path.join(import.meta.dirname, '..', 'datenbank');

export async function datenbankAufbauen() {
  await db.ausfuehren(`CREATE TABLE IF NOT EXISTS ausgefuehrte_sql_dateien (
    datei text PRIMARY KEY,
    am timestamptz NOT NULL DEFAULT now()
  )`);
  const erledigt = await db.alle('SELECT datei FROM ausgefuehrte_sql_dateien');
  const erledigteDateien = erledigt.map((zeile) => zeile.datei);

  const dateien = fs
    .readdirSync(SQL_ORDNER)
    .filter((datei) => datei.endsWith('.sql'))
    .sort();
  for (const datei of dateien) {
    if (erledigteDateien.includes(datei)) continue;
    const sql = fs.readFileSync(path.join(SQL_ORDNER, datei), 'utf8');
    await db.transaktion(async (t) => {
      await t.ausfuehren(sql);
      await t.ausfuehren('INSERT INTO ausgefuehrte_sql_dateien (datei) VALUES ($1)', [datei]);
    });
    console.log(`Datenbank: ${datei} ausgeführt`);
  }
}
