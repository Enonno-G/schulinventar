// Anmeldung und Abmeldung – Pflichtenheft Kap. 4 „Benutzerverwaltung und Anmeldung“, Kap. 5 „Sicherheit“
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config.js';
import { pool, query } from '../../db/pool.js';
import { writeAudit } from '../../lib/audit.js';
import { HttpError, invalidFields } from '../../lib/http-error.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { DEVICE_FIELDS_BY_ROLE, ROLES, permissionsFor } from '../../lib/permissions.js';
import { passwordSchema, z } from '../../lib/validate.js';
import { requireLogin } from '../../middleware/auth.js';

const router = Router();

// Vergleichswert, damit eine unbekannte E-Mail-Adresse gleich lange dauert wie ein falsches Passwort
const dummyHash = hashPassword('kein-echtes-passwort');

// Schutz gegen das Durchprobieren von Passwörtern: höchstens 10 Fehlversuche in 15 Minuten
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.' },
});

// Was die Oberfläche über den angemeldeten Benutzer wissen muss
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    role_label: ROLES[user.role],
    permissions: permissionsFor(user.role),
    editable_device_fields: DEVICE_FIELDS_BY_ROLE[user.role] ?? [],
    session_idle_minutes: config.sessionIdleMinutes,
  };
}

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Pflichtfeld').max(200),
  password: z.string().min(1, 'Pflichtfeld').max(200),
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { rows } = await query(
    'SELECT id, name, email, role, password_hash FROM users WHERE lower(email) = lower($1) AND active',
    [email],
  );
  const user = rows[0];
  const valid = await verifyPassword(password, user ? user.password_hash : await dummyHash);
  if (!user || !valid) throw new HttpError(401, 'E-Mail-Adresse oder Passwort ist falsch');

  // Neue Sitzungs-ID nach der Anmeldung (Schutz gegen Session Fixation)
  await new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
  req.session.userId = user.id;
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  res.json(publicUser(user));
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid');
    res.status(204).end();
  });
});

router.get('/me', requireLogin, (req, res) => {
  res.json(publicUser(req.user));
});

const passwordChangeSchema = z.object({
  current_password: z.string().min(1, 'Pflichtfeld'),
  new_password: passwordSchema,
});

// Eigenes Passwort ändern
router.post('/password', requireLogin, async (req, res) => {
  const { current_password, new_password } = passwordChangeSchema.parse(req.body);
  const {
    rows: [user],
  } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await verifyPassword(current_password, user.password_hash))) {
    throw invalidFields({ current_password: 'Das aktuelle Passwort ist falsch' });
  }
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(new_password), req.user.id]);
  await writeAudit(pool, { userId: req.user.id, entity: 'user', entityId: req.user.id, action: 'password_change' });
  res.status(204).end();
});

export default router;
