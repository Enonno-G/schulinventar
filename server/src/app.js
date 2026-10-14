import fs from 'node:fs';
import path from 'node:path';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { config } from './config.js';
import { pool, query } from './db/pool.js';
import { requireLogin } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import authRoutes from './modules/auth/routes.js';
import deviceRoutes from './modules/devices/routes.js';
import documentRoutes from './modules/documents/routes.js';
import exportRoutes from './modules/export/routes.js';
import importRoutes from './modules/import/routes.js';
import inventoryRoutes from './modules/inventory/routes.js';
import roomRoutes from './modules/rooms/routes.js';
import userRoutes from './modules/users/routes.js';

// Fertig gebaute Oberfläche (npm run build)
const CLIENT_DIST = path.resolve(import.meta.dirname, '../../client/dist');

export function createApp() {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);

  // Sicherheits-Header gegen typische Angriffe, z. B. Cross-Site-Scripting (Pflichtenheft Kap. 5)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { upgradeInsecureRequests: config.cookieSecure ? [] : null },
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // Sitzungen liegen in der Datenbank. "rolling" verlängert die Sitzung bei jeder Anfrage,
  // sie endet also erst nach SESSION_IDLE_MINUTES ohne Aktivität (automatische Abmeldung).
  const PgStore = connectPgSimple(session);
  const sessionStore = new PgStore({ pool, tableName: 'session' });
  app.locals.sessionStore = sessionStore;
  app.use(
    session({
      name: 'sid',
      store: sessionStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: config.cookieSecure,
        maxAge: config.sessionIdleMinutes * 60 * 1000,
      },
    }),
  );

  app.get('/api/health', async (req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', requireLogin); // alles darunter nur mit Anmeldung
  app.use('/api/users', userRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/inventories', inventoryRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unbekannte Adresse' }));

  // Im Betrieb liefert derselbe Server auch die Oberfläche aus
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('/{*path}', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
