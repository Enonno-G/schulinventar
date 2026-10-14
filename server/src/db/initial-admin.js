import { config } from '../config.js';
import { writeAudit } from '../lib/audit.js';
import { hashPassword } from '../lib/password.js';
import { pool } from './pool.js';

// Legt beim ersten Start einen Administrator an, damit man sich überhaupt anmelden kann.
// Danach legt der Administrator alle weiteren Konten in der App an.
export async function ensureInitialAdmin() {
  const {
    rows: [{ count }],
  } = await pool.query('SELECT count(*) FROM users');
  if (count > 0) return;

  const { name, email, password } = config.initialAdmin;
  if (!email || !password) {
    console.warn('Es gibt noch keinen Benutzer. ADMIN_EMAIL und ADMIN_PASSWORD in .env setzen und neu starten.');
    return;
  }
  if (password.length < 10) throw new Error('ADMIN_PASSWORD muss mindestens 10 Zeichen lang sein');

  const {
    rows: [user],
  } = await pool.query(
    `INSERT INTO users (name, email, role, password_hash) VALUES ($1, $2, 'admin', $3) RETURNING id, name, email, role`,
    [name, email.trim().toLowerCase(), await hashPassword(password)],
  );
  await writeAudit(pool, { entity: 'user', entityId: user.id, action: 'create', after: user });
  console.log(`Erster Administrator angelegt: ${user.email} (Passwort nach der ersten Anmeldung ändern)`);
}
