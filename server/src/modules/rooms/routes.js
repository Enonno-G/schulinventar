// Raumverwaltung – Pflichtenheft Kap. 4 „Raumverwaltung“
// Räume mit Raumnummer, Bezeichnung und Stockwerk. Löschen nur ohne zugeordnete Geräte.
import { Router } from 'express';
import { query, withTransaction } from '../../db/pool.js';
import { writeAudit } from '../../lib/audit.js';
import { HttpError, notFound } from '../../lib/http-error.js';
import { insertQuery, updateQuery } from '../../lib/sql.js';
import { idSchema, optionalText, parsePatch, requiredText, z } from '../../lib/validate.js';
import { requirePermission } from '../../middleware/auth.js';

const router = Router();

const roomSchema = z.object({
  number: requiredText(30),
  name: optionalText(100),
  floor: optionalText(50),
});

router.get('/', async (req, res) => {
  const { rows } = await query(`
    SELECT r.id, r.number, r.name, r.floor, count(d.id) AS device_count
    FROM rooms r LEFT JOIN devices d ON d.room_id = r.id
    GROUP BY r.id
    ORDER BY r.number`);
  res.json(rows);
});

// Raumansicht: der Raum mit allen Geräten
router.get('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const {
    rows: [room],
  } = await query('SELECT id, number, name, floor FROM rooms WHERE id = $1', [id]);
  if (!room) throw notFound('Raum');
  const { rows: devices } = await query(
    `SELECT id, inventory_number, description, device_type, serial_number, warranty_until
     FROM devices WHERE room_id = $1 ORDER BY inventory_number`,
    [id],
  );
  res.json({ ...room, devices });
});

router.post('/', requirePermission('rooms:write'), async (req, res) => {
  const fields = roomSchema.parse(req.body);
  const room = await withTransaction(async (db) => {
    const {
      rows: [created],
    } = await db.query(insertQuery('rooms', fields));
    await writeAudit(db, {
      userId: req.user.id,
      entity: 'room',
      entityId: created.id,
      action: 'create',
      after: created,
    });
    return created;
  });
  res.status(201).json(room);
});

router.patch('/:id', requirePermission('rooms:write'), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const changes = parsePatch(roomSchema, req.body);
  const room = await withTransaction(async (db) => {
    const {
      rows: [before],
    } = await db.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [id]);
    if (!before) throw notFound('Raum');
    if (Object.keys(changes).length === 0) return before;
    const {
      rows: [after],
    } = await db.query(updateQuery('rooms', id, changes));
    await writeAudit(db, { userId: req.user.id, entity: 'room', entityId: id, action: 'update', before, after });
    return after;
  });
  res.json(room);
});

router.delete('/:id', requirePermission('rooms:write'), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  await withTransaction(async (db) => {
    const {
      rows: [room],
    } = await db.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [id]);
    if (!room) throw notFound('Raum');
    const {
      rows: [{ count }],
    } = await db.query('SELECT count(*) FROM devices WHERE room_id = $1', [id]);
    if (count > 0) {
      throw new HttpError(
        409,
        `Der Raum kann nicht gelöscht werden, weil ihm noch ${count} ${count === 1 ? 'Gerät' : 'Geräte'} zugeordnet ${count === 1 ? 'ist' : 'sind'}`,
      );
    }
    await db.query('DELETE FROM rooms WHERE id = $1', [id]);
    await writeAudit(db, { userId: req.user.id, entity: 'room', entityId: id, action: 'delete', before: room });
  });
  res.status(204).end();
});

export default router;
