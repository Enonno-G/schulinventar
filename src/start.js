// Startet das Schulinventar: Datenbank vorbereiten, dann die Web-App auf Port 3000 starten.
// Aufruf: npm run dev (beim Entwickeln) oder npm start (im Docker-Container)
import { setTimeout as warten } from 'node:timers/promises';
import { appErstellen } from './app.js';
import { db, datenbankAufbauen, pool } from './datenbank.js';
import { einstellungen } from './einstellungen.js';
import { passwortHashen } from './passwort.js';
import { protokollieren } from './protokoll.js';

// Im Docker-Container braucht die Datenbank beim Start ein paar Sekunden
async function aufDatenbankWarten() {
  for (let versuch = 1; versuch <= 15; versuch++) {
    try {
      await db.eine('SELECT 1');
      return;
    } catch (fehler) {
      if (versuch === 15) throw fehler;
      console.log('Datenbank noch nicht erreichbar, neuer Versuch in 2 Sekunden …');
      await warten(2000);
    }
  }
}

// Beim allerersten Start gibt es noch keinen Benutzer. Dann wird der Administrator aus .env angelegt.
async function erstenAdminAnlegen() {
  const zaehlung = await db.eine('SELECT count(*) AS anzahl FROM benutzer');
  if (zaehlung.anzahl > 0) return;

  const { name, email, passwort } = einstellungen.ersterAdmin;
  if (!email || !passwort) {
    console.warn('Es gibt noch keinen Benutzer. ADMIN_EMAIL und ADMIN_PASSWORD in .env eintragen und neu starten.');
    return;
  }
  if (passwort.length < 10) throw new Error('ADMIN_PASSWORD muss mindestens 10 Zeichen lang sein.');

  const admin = await db.eine(
    `INSERT INTO benutzer (name, email, rolle, passwort_hash) VALUES ($1, $2, 'admin', $3)
     RETURNING id, name, email, rolle`,
    [name, email.trim().toLowerCase(), await passwortHashen(passwort)],
  );
  await protokollieren(db, { bereich: 'benutzer', eintragId: admin.id, aktion: 'angelegt', nachher: admin });
  console.log(`Erster Administrator angelegt: ${admin.email} (Passwort nach der ersten Anmeldung ändern)`);
}

await aufDatenbankWarten();
await datenbankAufbauen();
await erstenAdminAnlegen();

const app = appErstellen();
const server = app.listen(einstellungen.port, () => {
  console.log(`Schulinventar läuft: http://localhost:${einstellungen.port}`);
});

// Sauber beenden, z. B. bei „docker compose stop“ oder Strg+C
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(async () => {
      app.locals.sitzungsSpeicher.close();
      await pool.end();
      process.exit(0);
    });
  });
}
