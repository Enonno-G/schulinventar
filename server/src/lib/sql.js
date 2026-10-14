// Hilfsfunktionen für INSERT und UPDATE.
// Spaltennamen stammen immer aus einem Zod-Schema, nie direkt aus der Anfrage. Werte werden als
// Parameter ($1, $2, …) übergeben. Dadurch ist SQL-Injection ausgeschlossen (Pflichtenheft Kap. 5).

function checkColumns(keys) {
  for (const key of keys) {
    if (!/^[a-z_]+$/.test(key)) throw new Error(`Ungültiger Spaltenname: ${key}`);
  }
}

export function insertQuery(table, fields, returning = '*') {
  const keys = Object.keys(fields);
  checkColumns(keys);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  return {
    text: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${returning}`,
    values: keys.map((key) => fields[key]),
  };
}

export function updateQuery(table, id, fields, returning = '*') {
  const keys = Object.keys(fields);
  checkColumns(keys);
  const assignments = keys.map((key, i) => `${key} = $${i + 2}`);
  return {
    text: `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = $1 RETURNING ${returning}`,
    values: [id, ...keys.map((key) => fields[key])],
  };
}

// Sonderzeichen für ILIKE maskieren, damit z. B. "%" im Suchbegriff wörtlich gesucht wird
export function escapeLike(text) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
