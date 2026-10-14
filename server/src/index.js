import { setTimeout as sleep } from 'node:timers/promises';
import { createApp } from './app.js';
import { config } from './config.js';
import { ensureInitialAdmin } from './db/initial-admin.js';
import { migrate } from './db/migrate.js';
import { pool } from './db/pool.js';

// Beim Start im Docker-Container ist die Datenbank eventuell noch nicht bereit
async function waitForDatabase(attempts = 15) {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.log(`Datenbank noch nicht erreichbar (${err.code ?? err.message}), neuer Versuch in 2 Sekunden …`);
      await sleep(2000);
    }
  }
}

await waitForDatabase();
await migrate();
await ensureInitialAdmin();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`Schulinventar läuft auf http://localhost:${config.port}`);
});

// Sauber beenden, z. B. bei "docker compose stop"
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => {
      app.locals.sessionStore.close();
      pool.end().then(() => process.exit(0));
    });
  });
}
