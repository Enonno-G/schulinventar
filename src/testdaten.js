// Legt Testdaten an, damit man beim Entwickeln etwas zum Anschauen hat
// (Jira: „Testdaten erzeugen (500 und 10.000 Geräte)“).
//
//   npm run testdaten            500 Geräte
//   npm run testdaten -- 10000   10.000 Geräte (für den Performance-Test)
//
// Außerdem je Rolle ein Testbenutzer (siehe TESTBENUTZER), Passwort = SEED_PASSWORD aus .env.
// Kann mehrmals ausgeführt werden: Was es schon gibt, wird nicht doppelt angelegt.
import { db, datenbankAufbauen, pool } from './datenbank.js';
import { einstellungen } from './einstellungen.js';
import { passwortHashen } from './passwort.js';

const TESTBENUTZER = [
  ['Test Administrator', 'admin@test.local', 'admin'],
  ['Test Rechnungswesen', 'rechnungswesen@test.local', 'rechnungswesen'],
  ['Test Facility-Management', 'facility@test.local', 'facility'],
  ['Test Lesezugriff', 'lesen@test.local', 'lesen'],
];

const STOCKWERKE = [
  ['E', 'Erdgeschoß'],
  ['1', '1. Stock'],
  ['2', '2. Stock'],
];
const RAUMBEZEICHNUNGEN = [
  'Klassenraum',
  'EDV-Saal',
  'Übungsfirma',
  'Konferenzzimmer',
  'Sekretariat',
  'Bibliothek',
  'Lehrerzimmer',
];

// [Gerätetyp, Bezeichnung, hat eine Seriennummer?]
const GERAETETYPEN = [
  ['PC', 'PC Arbeitsplatz', true],
  ['Monitor', 'Monitor 24 Zoll', true],
  ['Notebook', 'Notebook', true],
  ['Beamer', 'Beamer Deckenmontage', true],
  ['Drucker', 'Laserdrucker', true],
  ['Dokumentenkamera', 'Dokumentenkamera', true],
  ['Tisch', 'Schülertisch', false],
  ['Sessel', 'Drehsessel', false],
];

if (einstellungen.imBetrieb) {
  console.error('Im Betrieb werden keine Testdaten angelegt.');
  process.exit(1);
}
const passwort = process.env.SEED_PASSWORD;
if (!passwort || passwort.length < 10) {
  console.error('Bitte SEED_PASSWORD (mindestens 10 Zeichen) in .env eintragen.');
  process.exit(1);
}
const anzahlGeraete = Number(process.argv[2] || 500);

await datenbankAufbauen();

await db.transaktion(async (t) => {
  const passwortHash = await passwortHashen(passwort);
  for (const [name, email, rolle] of TESTBENUTZER) {
    await t.ausfuehren(
      `INSERT INTO benutzer (name, email, rolle, passwort_hash) VALUES ($1, $2, $3, $4)
       ON CONFLICT ((lower(email))) DO NOTHING`,
      [name, email, rolle, passwortHash],
    );
  }

  // Drei Stockwerke mit je zehn Räumen: E.01 bis 2.10
  for (const [kurz, stockwerk] of STOCKWERKE) {
    for (let i = 1; i <= 10; i++) {
      const raumnummer = `${kurz}.${String(i).padStart(2, '0')}`;
      const bezeichnung = RAUMBEZEICHNUNGEN[(i - 1) % RAUMBEZEICHNUNGEN.length];
      await t.ausfuehren(
        'INSERT INTO raeume (nummer, bezeichnung, stockwerk) VALUES ($1, $2, $3) ON CONFLICT (nummer) DO NOTHING',
        [raumnummer, bezeichnung, stockwerk],
      );
    }
  }
  const raeume = await t.alle('SELECT id, nummer FROM raeume ORDER BY nummer');

  // Geräte so, wie sie aus SAP kommen könnten: fortlaufende Inventarnummer, Raum laut SAP
  for (let i = 1; i <= anzahlGeraete; i++) {
    const [typ, bezeichnung, hatSeriennummer] = GERAETETYPEN[i % GERAETETYPEN.length];
    const raum = raeume[i % raeume.length];
    const jahr = 2018 + (i % 8);
    const monat = String((i % 12) + 1).padStart(2, '0');
    const tag = String((i % 28) + 1).padStart(2, '0');
    await t.ausfuehren(
      `INSERT INTO geraete (inventarnummer, bezeichnung, typ, seriennummer, raum_id, sap_raumnummer,
                            anschaffungsdatum, garantie_bis, herkunft, sap_importiert_am)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sap', now())
       ON CONFLICT (inventarnummer) DO NOTHING`,
      [
        String(20000000 + i),
        bezeichnung,
        typ,
        hatSeriennummer ? `SN-${typ.slice(0, 3).toUpperCase()}-${100000 + i}` : null,
        raum.id,
        raum.nummer,
        `${jahr}-${monat}-${tag}`,
        hatSeriennummer ? `${jahr + 3}-${monat}-${tag}` : null, // 3 Jahre Garantie
      ],
    );
  }
});

const zaehlung = await db.eine('SELECT count(*) AS anzahl FROM geraete');
console.log(`Testdaten fertig: ${TESTBENUTZER.length} Testbenutzer, 30 Räume, ${zaehlung.anzahl} Geräte insgesamt`);
await pool.end();
