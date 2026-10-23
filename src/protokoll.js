// Änderungsprotokoll (Pflichtenheft Kap. 4): jede Änderung mit Zeitpunkt und Benutzer.
// Die Datenbank verhindert, dass Einträge nachträglich geändert oder gelöscht werden.

// Diese Felder kommen nicht ins Protokoll
const NICHT_PROTOKOLLIEREN = ['id', 'angelegt_am', 'geaendert_am', 'passwort_hash'];

// Vergleicht den Stand vorher und nachher und liefert nur die geänderten Felder, z. B.
//   { anmerkungen: { vorher: null, nachher: 'Lampe defekt' } }
export function unterschiede(vorher, nachher) {
  const alleFelder = new Set([...Object.keys(vorher ?? {}), ...Object.keys(nachher ?? {})]);
  const aenderungen = {};
  for (const feld of alleFelder) {
    if (NICHT_PROTOKOLLIEREN.includes(feld)) continue;
    const alt = vorher?.[feld] ?? null;
    const neu = nachher?.[feld] ?? null;
    if (JSON.stringify(alt) !== JSON.stringify(neu)) {
      aenderungen[feld] = { vorher: alt, nachher: neu };
    }
  }
  return aenderungen;
}

// Schreibt einen Eintrag. `db` ist die Datenbank oder – innerhalb einer Transaktion – `t`,
// damit der Eintrag nur gespeichert wird, wenn auch die Änderung selbst gespeichert wird.
export async function protokollieren(db, { benutzerId, bereich, eintragId, aktion, vorher, nachher }) {
  const aenderungen = unterschiede(vorher, nachher);
  if (aktion === 'geaendert' && Object.keys(aenderungen).length === 0) return; // nichts geändert
  await db.ausfuehren(
    'INSERT INTO protokoll (benutzer_id, bereich, eintrag_id, aktion, aenderungen) VALUES ($1, $2, $3, $4, $5)',
    [benutzerId ?? null, bereich, String(eintragId), aktion, aenderungen],
  );
}
