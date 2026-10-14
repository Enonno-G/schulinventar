import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';

// Meldungen für verletzte Eindeutigkeit (Name des Constraints in der Datenbank)
const UNIQUE_MESSAGES = {
  devices_inventory_number_key: 'Diese Inventarnummer ist bereits vorhanden',
  rooms_number_key: 'Diese Raumnummer ist bereits vorhanden',
  users_email_unique: 'Diese E-Mail-Adresse ist bereits vergeben',
  suppliers_name_unique: 'Diesen Lieferanten gibt es bereits',
};

// Wandelt alle Fehler in verständliche deutsche Meldungen um (Pflichtenheft Kap. 4).
// Antwort immer: { error: 'Meldung', fields: { feld: 'Meldung zum Feld' } }
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    return res.status(400).json({ error: 'Bitte die markierten Eingaben prüfen', fields });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, fields: err.fields });
  }
  // Fehlercodes von PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ error: UNIQUE_MESSAGES[err.constraint] ?? 'Dieser Eintrag ist bereits vorhanden' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Der Eintrag ist noch mit anderen Daten verknüpft' });
  }
  if (err.code === 'P0001') {
    return res.status(409).json({ error: err.message }); // Meldung aus einem Trigger (RAISE EXCEPTION)
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Die Anfrage enthält ungültige Daten' });
  }

  console.error(err);
  res.status(500).json({ error: 'Interner Fehler. Bitte später erneut versuchen.' });
}
