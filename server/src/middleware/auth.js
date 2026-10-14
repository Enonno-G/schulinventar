import { query } from '../db/pool.js';
import { HttpError } from '../lib/http-error.js';
import { hasPermission } from '../lib/permissions.js';

// Lässt nur angemeldete, aktive Benutzer durch. Der Benutzer wird bei jeder Anfrage neu geladen,
// damit eine geänderte Rolle oder ein deaktiviertes Konto sofort wirkt.
export async function requireLogin(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) throw new HttpError(401, 'Nicht angemeldet');

  const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1 AND active', [userId]);
  if (rows.length === 0) {
    req.session.destroy(() => {});
    throw new HttpError(401, 'Nicht angemeldet');
  }
  req.user = rows[0];
  next();
}

// Prüft eine Berechtigung aus lib/permissions.js, z. B. requirePermission('rooms:write')
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user?.role, permission)) {
      throw new HttpError(403, 'Dafür fehlt Ihnen die Berechtigung');
    }
    next();
  };
}
