// Zentrale Konfiguration. Die Werte kommen aus der Datei .env (Entwicklung)
// bzw. aus docker-compose.yml (Betrieb). Vorlage: .env.example
const env = process.env;
const isProduction = env.NODE_ENV === 'production';

function required(name) {
  const value = env[name];
  if (!value) throw new Error(`Die Umgebungsvariable ${name} fehlt (siehe .env.example)`);
  return value;
}

const sessionSecret = env.SESSION_SECRET || (isProduction ? '' : 'nur-fuer-die-entwicklung');
if (isProduction && sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET muss im Echtbetrieb mindestens 32 Zeichen lang sein (siehe .env.example)');
}

export const config = {
  isProduction,
  port: Number(env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret,
  // Automatische Abmeldung nach so vielen Minuten ohne Aktivität (Pflichtenheft Kap. 5)
  sessionIdleMinutes: Number(env.SESSION_IDLE_MINUTES ?? 30),
  // Nur über HTTPS: Cookie mit "Secure" und Weitergabe der Client-Adresse durch den Reverse Proxy
  cookieSecure: env.COOKIE_SECURE === 'true',
  trustProxy: env.TRUST_PROXY === 'true',
  // Wird beim ersten Start angelegt, solange es noch keinen Benutzer gibt
  initialAdmin: {
    name: env.ADMIN_NAME || 'Administrator',
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  },
};
