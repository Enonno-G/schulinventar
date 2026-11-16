// Einstellungen aus der Datei .env (beim Entwickeln) bzw. aus docker-compose.yml (im Betrieb).
// Was die einzelnen Werte bedeuten, steht in .env.example.
import path from 'node:path';

const imBetrieb = process.env.NODE_ENV === 'production';

export const einstellungen = {
  imBetrieb,
  port: Number(process.env.PORT || 3000),
  datenbankAdresse: process.env.DATABASE_URL,
  sitzungsSchluessel: process.env.SESSION_SECRET || 'nur-zum-entwickeln',
  abmeldenNachMinuten: Number(process.env.SESSION_IDLE_MINUTES || 30),
  nurUeberHttps: process.env.COOKIE_SECURE === 'true',
  hinterProxy: process.env.TRUST_PROXY === 'true',
  ersterAdmin: {
    name: process.env.ADMIN_NAME || 'Administrator',
    email: process.env.ADMIN_EMAIL,
    passwort: process.env.ADMIN_PASSWORD,
  },
  // Hochgeladene Belege: wo sie liegen, wie groß sie sein dürfen und wie lange sie aufbewahrt werden müssen
  uploadOrdner: path.resolve(process.env.UPLOAD_DIR || path.join(import.meta.dirname, '..', 'uploads')),
  uploadHoechstMB: Number(process.env.UPLOAD_MAX_MB || 10),
  aufbewahrungJahre: Number(process.env.AUFBEWAHRUNG_JAHRE || 7),
};

if (!einstellungen.datenbankAdresse) {
  throw new Error('DATABASE_URL fehlt. Bitte .env.example nach .env kopieren und ausfüllen.');
}
if (imBetrieb && einstellungen.sitzungsSchluessel.length < 32) {
  throw new Error('SESSION_SECRET muss im Betrieb mindestens 32 Zeichen lang sein (siehe .env.example).');
}
