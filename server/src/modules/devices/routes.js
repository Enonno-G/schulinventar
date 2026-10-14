// Geräte – Pflichtenheft Kap. 4 „Export in Web-App“ (Liste, Filter, Suche, Detailansicht),
// „Raumverwaltung“ (Raumwechsel mit Datum) und „Verarbeitung dieser Daten“ (Prüfung der Eingaben)
import { Router } from 'express';
import { query, withTransaction } from '../../db/pool.js';
import { writeAudit } from '../../lib/audit.js';
import { HttpError, invalidFields, notFound } from '../../lib/http-error.js';
import { DEVICE_FIELDS_BY_ROLE } from '../../lib/permissions.js';
import { escapeLike, insertQuery, updateQuery } from '../../lib/sql.js';
import { idSchema, optionalDate, optionalText, parsePatch, requiredText, withoutEmpty, z } from '../../lib/validate.js';
import { requirePermission } from '../../middleware/auth.js';

const router = Router();

const FIELD_LABELS = {
  inventory_number: 'Inventarnummer',
  description: 'Bezeichnung',
  device_type: 'Gerätetyp',
  serial_number: 'Seriennummer',
  room_id: 'Raum',
  acquisition_date: 'Anschaffungsdatum',
  purchase_date: 'Kaufdatum',
  commissioning_date: 'Inbetriebnahme',
  warranty_until: 'Garantie bis',
  notes: 'Anmerkungen',
};

const deviceSchema = z.object({
  inventory_number: requiredText(50),
  description: requiredText(200),
  device_type: optionalText(100),
  serial_number: optionalText(100),
  room_id: z.coerce.number().int().positive('Bitte einen Raum auswählen'),
  acquisition_date: optionalDate,
  purchase_date: optionalDate,
  commissioning_date: optionalDate,
  warranty_until: optionalDate,
  notes: optionalText(2000),
});

// Plausibilität der Datumsangaben (ISO-Daten lassen sich als Text vergleichen)
function checkDates(device) {
  const fields = {};
  if (device.purchase_date && device.warranty_until && device.warranty_until < device.purchase_date) {
    fields.warranty_until = 'Garantie bis darf nicht vor dem Kaufdatum liegen';
  }
  if (device.purchase_date && device.commissioning_date && device.commissioning_date < device.purchase_date) {
    fields.commissioning_date = 'Die Inbetriebnahme darf nicht vor dem Kaufdatum liegen';
  }
  if (Object.keys(fields).length > 0) throw invalidFields(fields);
}

async function getRoom(db, roomId) {
  const { rows } = await db.query('SELECT id, number FROM rooms WHERE id = $1', [roomId]);
  if (!rows[0]) throw invalidFields({ room_id: 'Raum nicht gefunden' });
  return rows[0];
}

const SORT_COLUMNS = {
  inventory_number: 'd.inventory_number',
  description: 'd.description',
  device_type: 'd.device_type',
  room: 'r.number',
  warranty_until: 'd.warranty_until',
};

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  room_id: idSchema.optional(),
  device_type: z.string().trim().max(100).optional(),
  warranty_to: z.iso.date().optional(), // Garantie endet spätestens an diesem Tag
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(Object.keys(SORT_COLUMNS)).default('inventory_number'),
  dir: z.enum(['asc', 'desc']).default('asc'),
});

// Geräteliste mit Suche, Filtern und Seiten
router.get('/', async (req, res) => {
  const filters = listSchema.parse(withoutEmpty(req.query));
  const conditions = [];
  const params = [];
  const param = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.search) {
    const term = param(`%${escapeLike(filters.search)}%`);
    conditions.push(
      `(d.inventory_number ILIKE ${term} OR d.serial_number ILIKE ${term} OR d.description ILIKE ${term})`,
    );
  }
  if (filters.room_id) conditions.push(`d.room_id = ${param(filters.room_id)}`);
  if (filters.device_type) conditions.push(`d.device_type = ${param(filters.device_type)}`);
  if (filters.warranty_to) conditions.push(`d.warranty_until <= ${param(filters.warranty_to)}`);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const {
    rows: [{ count }],
  } = await query(`SELECT count(*) FROM devices d ${where}`, params);
  const { rows } = await query(
    `SELECT d.id, d.inventory_number, d.description, d.device_type, d.serial_number, d.warranty_until,
            d.source, d.room_id, r.number AS room_number, r.name AS room_name
     FROM devices d JOIN rooms r ON r.id = d.room_id
     ${where}
     ORDER BY ${SORT_COLUMNS[filters.sort]} ${filters.dir} NULLS LAST, d.id
     LIMIT ${param(filters.page_size)} OFFSET ${param((filters.page - 1) * filters.page_size)}`,
    params,
  );
  res.json({ items: rows, total: count, page: filters.page, page_size: filters.page_size });
});

// Vorhandene Gerätetypen für Filter und Auswahlliste
router.get('/types', async (req, res) => {
  const { rows } = await query(
    'SELECT DISTINCT device_type FROM devices WHERE device_type IS NOT NULL ORDER BY device_type',
  );
  res.json(rows.map((row) => row.device_type));
});

// Detailansicht mit Belegen, Raumwechseln und Änderungsprotokoll
router.get('/:id', async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const {
    rows: [device],
  } = await query(
    `SELECT d.*, r.number AS room_number, r.name AS room_name, s.name AS supplier_name
     FROM devices d
     JOIN rooms r ON r.id = d.room_id
     LEFT JOIN suppliers s ON s.id = d.supplier_id
     WHERE d.id = $1`,
    [id],
  );
  if (!device) throw notFound('Gerät');

  const [documents, roomChanges, history] = await Promise.all([
    query(
      `SELECT doc.id, doc.kind, doc.original_name, doc.document_date, doc.uploaded_at
       FROM device_documents dd JOIN documents doc ON doc.id = dd.document_id
       WHERE dd.device_id = $1 ORDER BY doc.uploaded_at DESC`,
      [id],
    ),
    query(
      `SELECT rc.changed_at, rc.reason, rc.from_room_number, rc.to_room_number, u.name AS changed_by_name
       FROM room_changes rc LEFT JOIN users u ON u.id = rc.changed_by
       WHERE rc.device_id = $1 ORDER BY rc.changed_at DESC`,
      [id],
    ),
    query(
      `SELECT a.at, a.action, a.changes, u.name AS user_name
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.entity = 'device' AND a.entity_id = $1 ORDER BY a.at DESC LIMIT 100`,
      [String(id)],
    ),
  ]);
  res.json({ ...device, documents: documents.rows, room_changes: roomChanges.rows, history: history.rows });
});

// Gerät manuell anlegen, z. B. wenn es nicht in der SAP-Liste steht
router.post('/', requirePermission('devices:create'), async (req, res) => {
  const fields = deviceSchema.parse(req.body);
  checkDates(fields);
  const device = await withTransaction(async (db) => {
    const room = await getRoom(db, fields.room_id);
    const {
      rows: [created],
    } = await db.query(insertQuery('devices', { ...fields, source: 'manual' }));
    await writeAudit(db, {
      userId: req.user.id,
      entity: 'device',
      entityId: created.id,
      action: 'create',
      after: { ...created, room_number: room.number },
    });
    return created;
  });
  res.status(201).json(device);
});

router.patch('/:id', requirePermission('devices:edit'), async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const changes = parsePatch(deviceSchema, req.body);

  const allowed = DEVICE_FIELDS_BY_ROLE[req.user.role] ?? [];
  const forbidden = Object.keys(changes).filter((key) => !allowed.includes(key));
  if (forbidden.length > 0) {
    throw new HttpError(
      403,
      `Diese Felder dürfen Sie nicht ändern: ${forbidden.map((key) => FIELD_LABELS[key]).join(', ')}`,
    );
  }

  const device = await withTransaction(async (db) => {
    const {
      rows: [before],
    } = await db.query(
      'SELECT d.*, r.number AS room_number FROM devices d JOIN rooms r ON r.id = d.room_id WHERE d.id = $1 FOR UPDATE OF d',
      [id],
    );
    if (!before) throw notFound('Gerät');
    if (before.source === 'sap' && changes.inventory_number && changes.inventory_number !== before.inventory_number) {
      throw invalidFields({ inventory_number: 'Die Inventarnummer von Geräten aus SAP kann nicht geändert werden' });
    }
    checkDates({ ...before, ...changes });
    if (Object.keys(changes).length === 0) return before;

    const roomChanged = changes.room_id !== undefined && changes.room_id !== before.room_id;
    const roomNumber = roomChanged ? (await getRoom(db, changes.room_id)).number : before.room_number;
    const {
      rows: [after],
    } = await db.query(updateQuery('devices', id, changes));

    // Raumwechsel mit Datum speichern (Pflichtenheft Kap. 4 Raumverwaltung)
    if (roomChanged) {
      await db.query(
        `INSERT INTO room_changes (device_id, from_room_id, from_room_number, to_room_id, to_room_number, reason, changed_by)
         VALUES ($1, $2, $3, $4, $5, 'manual', $6)`,
        [id, before.room_id, before.room_number, after.room_id, roomNumber, req.user.id],
      );
    }
    await writeAudit(db, {
      userId: req.user.id,
      entity: 'device',
      entityId: id,
      action: 'update',
      before,
      after: { ...after, room_number: roomNumber },
    });
    return after;
  });
  res.json(device);
});

export default router;
