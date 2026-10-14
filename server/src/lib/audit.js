// Änderungsprotokoll (Pflichtenheft Kap. 4: jede Änderung wird mit Datum und Benutzer protokolliert)

// Felder, die nicht ins Protokoll gehören
const IGNORED_FIELDS = new Set(['id', 'created_at', 'updated_at', 'password_hash']);

// Vergleicht zwei Stände eines Datensatzes und liefert nur die geänderten Felder:
// { feld: { old: alterWert, new: neuerWert } }
export function diff(before, after) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes = {};
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const oldValue = before?.[key] ?? null;
    const newValue = after?.[key] ?? null;
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = { old: oldValue, new: newValue };
    }
  }
  return changes;
}

// Schreibt einen Protokolleintrag. `db` ist der Pool oder der Client einer laufenden Transaktion,
// damit der Eintrag nur gespeichert wird, wenn auch die Änderung selbst gespeichert wird.
export async function writeAudit(db, { userId = null, entity, entityId, action, before = null, after = null }) {
  const changes = diff(before, after);
  if (action === 'update' && Object.keys(changes).length === 0) return;
  await db.query('INSERT INTO audit_log (user_id, entity, entity_id, action, changes) VALUES ($1, $2, $3, $4, $5)', [
    userId,
    entity,
    String(entityId),
    action,
    changes,
  ]);
}
