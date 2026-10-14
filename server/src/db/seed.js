// Testdaten für die Entwicklung (Jira: „Testdaten erzeugen (500 und 10.000 Geräte)“)
//
//   npm run db:seed              500 Geräte
//   npm run db:seed -- 10000     10.000 Geräte für den Performance-Test
//
// Legt außerdem je Rolle einen Testbenutzer an (siehe TEST_USERS, Passwort = SEED_PASSWORD aus .env).
// Kann mehrfach ausgeführt werden: Vorhandenes wird nicht doppelt angelegt.
import { config } from '../config.js';
import { hashPassword } from '../lib/password.js';
import { migrate } from './migrate.js';
import { pool, withTransaction } from './pool.js';

const TEST_USERS = [
  ['Test Administrator', 'admin@test.local', 'admin'],
  ['Test Rechnungswesen', 'rechnungswesen@test.local', 'accounting'],
  ['Test Facility-Management', 'facility@test.local', 'facility'],
  ['Test Lesezugriff', 'lesen@test.local', 'readonly'],
];

const FLOORS = [
  ['E', 'Erdgeschoß'],
  ['1', '1. Stock'],
  ['2', '2. Stock'],
];
const ROOM_NAMES = [
  'Klassenraum',
  'EDV-Saal',
  'Übungsfirma',
  'Konferenzzimmer',
  'Sekretariat',
  'Bibliothek',
  'Lehrerzimmer',
];

// [Gerätetyp, Bezeichnung, hat Seriennummer]
const DEVICE_TYPES = [
  ['PC', 'PC Arbeitsplatz', true],
  ['Monitor', 'Monitor 24 Zoll', true],
  ['Notebook', 'Notebook', true],
  ['Beamer', 'Beamer Deckenmontage', true],
  ['Drucker', 'Laserdrucker', true],
  ['Dokumentenkamera', 'Dokumentenkamera', true],
  ['Tisch', 'Schülertisch', false],
  ['Sessel', 'Drehsessel', false],
];

if (config.isProduction) {
  console.error('Testdaten werden im Echtbetrieb nicht angelegt.');
  process.exit(1);
}
const deviceCount = Number(process.argv[2] ?? 500);
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 10) {
  console.error('SEED_PASSWORD (mindestens 10 Zeichen) in .env setzen.');
  process.exit(1);
}

const isoDate = (date) => date.toISOString().slice(0, 10);

try {
  await migrate();
  await withTransaction(async (db) => {
    const passwordHash = await hashPassword(password);
    for (const [name, email, role] of TEST_USERS) {
      await db.query(
        `INSERT INTO users (name, email, role, password_hash) VALUES ($1, $2, $3, $4)
         ON CONFLICT ((lower(email))) DO NOTHING`,
        [name, email, role, passwordHash],
      );
    }

    // Drei Stockwerke mit je zehn Räumen: E.01 … 2.10
    const rooms = FLOORS.flatMap(([prefix, floor]) =>
      Array.from({ length: 10 }, (_, i) => ({
        number: `${prefix}.${String(i + 1).padStart(2, '0')}`,
        name: ROOM_NAMES[i % ROOM_NAMES.length],
        floor,
      })),
    );
    await db.query(
      `INSERT INTO rooms (number, name, floor)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
       ON CONFLICT (number) DO NOTHING`,
      [rooms.map((r) => r.number), rooms.map((r) => r.name), rooms.map((r) => r.floor)],
    );
    const { rows: roomRows } = await db.query('SELECT id, number FROM rooms ORDER BY number');

    // Geräte so, wie sie aus SAP kommen könnten: fortlaufende Inventarnummer, Raum laut SAP
    const columns = {
      inv: [],
      description: [],
      type: [],
      serial: [],
      roomId: [],
      roomNumber: [],
      acquired: [],
      warranty: [],
    };
    for (let i = 1; i <= deviceCount; i++) {
      const [type, description, hasSerial] = DEVICE_TYPES[i % DEVICE_TYPES.length];
      const room = roomRows[i % roomRows.length];
      const acquired = new Date(Date.UTC(2018 + (i % 8), i % 12, 1 + (i % 28)));
      const warranty = new Date(acquired);
      warranty.setUTCFullYear(warranty.getUTCFullYear() + 3);
      columns.inv.push(String(20000000 + i));
      columns.description.push(description);
      columns.type.push(type);
      columns.serial.push(hasSerial ? `SN-${type.slice(0, 3).toUpperCase()}-${100000 + i}` : null);
      columns.roomId.push(room.id);
      columns.roomNumber.push(room.number);
      columns.acquired.push(isoDate(acquired));
      columns.warranty.push(hasSerial ? isoDate(warranty) : null);
    }
    const { rowCount } = await db.query(
      `INSERT INTO devices (inventory_number, description, device_type, serial_number, room_id,
                            sap_room_number, acquisition_date, warranty_until, source, sap_imported_at)
       SELECT inv, description, type, serial, room_id, room_number, acquired, warranty, 'sap', now()
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::int[], $6::text[], $7::date[], $8::date[])
         AS t(inv, description, type, serial, room_id, room_number, acquired, warranty)
       ON CONFLICT (inventory_number) DO NOTHING`,
      Object.values(columns),
    );
    console.log(`Testdaten: ${TEST_USERS.length} Benutzer, ${rooms.length} Räume, ${rowCount} neue Geräte`);
  });
} finally {
  await pool.end();
}
