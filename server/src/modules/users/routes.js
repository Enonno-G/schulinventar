// Benutzerverwaltung (nur Administrator) – Pflichtenheft Kap. 4 „Benutzerverwaltung und Anmeldung“
// Gespeichert werden nur Name, E-Mail-Adresse und Rolle (Kap. 5 Datenschutz).
import { Router } from 'express';
import { query, withTransaction } from '../../db/pool.js';
import { writeAudit } from '../../lib/audit.js';
import { HttpError, notFound } from '../../lib/http-error.js';
import { hashPassword } from '../../lib/password.js';
import { ROLES } from '../../lib/permissions.js';
import { updateQuery } from '../../lib/sql.js';
import { idSchema, parsePatch, passwordSchema, requiredText, z } from '../../lib/validate.js';
import { requirePermission } from '../../middleware/auth.js';

const router = Router();
router.use(requirePermission('users:manage'));

const USER_COLUMNS = 'id, name, email, role, active, last_login_at, created_at';

const userSchema = z.object({
  name: requiredText(100),
  email: z.string().trim().toLowerCase().pipe(z.email('Ungültige E-Mail-Adresse').max(200)),
  role: z.enum(Object.keys(ROLES)),
  active: z.boolean(),
  password: passwordSchema,
});

router.get('/', async (req, res) => {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users ORDER BY active DESC, name`);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, email, role, password } = userSchema.omit({ active: true }).parse(req.body);
  const user = await withTransaction(async (db) => {
    const {
      rows: [created],
    } = await db.query(
      `INSERT INTO users (name, email, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`,
      [name, email, role, await hashPassword(password)],
    );
    await writeAudit(db, {
      userId: req.user.id,
      entity: 'user',
      entityId: created.id,
      action: 'create',
      after: created,
    });
    return created;
  });
  res.status(201).json(user);
});

router.patch('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const { password, ...changes } = parsePatch(userSchema, req.body);

  const user = await withTransaction(async (db) => {
    const {
      rows: [before],
    } = await db.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`, [id]);
    if (!before) throw notFound('Benutzer');

    const removesAdmin = (changes.role && changes.role !== 'admin') || changes.active === false;
    if (id === req.user.id && removesAdmin) {
      throw new HttpError(400, 'Sie können sich nicht selbst deaktivieren oder Ihre Administratorrolle entfernen');
    }
    if (before.role === 'admin' && before.active && removesAdmin) {
      const {
        rows: [{ count }],
      } = await db.query(`SELECT count(*) FROM users WHERE role = 'admin' AND active AND id <> $1`, [id]);
      if (count === 0) throw new HttpError(400, 'Es muss mindestens ein aktiver Administrator bleiben');
    }

    const fields = { ...changes };
    if (password) fields.password_hash = await hashPassword(password);
    if (Object.keys(fields).length === 0) return before;

    const {
      rows: [after],
    } = await db.query(updateQuery('users', id, fields, USER_COLUMNS));
    await writeAudit(db, { userId: req.user.id, entity: 'user', entityId: id, action: 'update', before, after });
    if (password) await writeAudit(db, { userId: req.user.id, entity: 'user', entityId: id, action: 'password_reset' });
    return after;
  });
  res.json(user);
});

export default router;
