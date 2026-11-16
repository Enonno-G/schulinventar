// Anzeige von Werten auf Deutsch. Diese Funktionen können alle Seiten-Vorlagen direkt verwenden.

// '2026-10-14' -> '14.10.2026'
// Auch ein Zeitpunkt (z. B. „erfasst am“) geht, dann zählt der Tag in Österreich.
export function datum(wert) {
  if (!wert) return '–';
  if (wert instanceof Date) {
    return wert.toLocaleDateString('de-AT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Vienna',
    });
  }
  const [jahr, monat, tag] = String(wert).slice(0, 10).split('-');
  return `${tag}.${monat}.${jahr}`;
}

// Zeitpunkt -> '14.10.2026, 09:48' (österreichische Zeit, auch wenn der Server in UTC läuft)
export function datumZeit(wert) {
  if (!wert) return '–';
  return new Date(wert).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' });
}

// 1536000 -> '1,5 MB'
export function dateigroesse(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('de-AT', { maximumFractionDigits: 1 })} MB`;
}

// 'E.01' und 'Klassenraum' -> 'E.01 – Klassenraum'
export function raumName(nummer, bezeichnung) {
  if (!bezeichnung) return nummer;
  return `${nummer} – ${bezeichnung}`;
}

// Deutsche Namen der Felder, z. B. für das Änderungsprotokoll
export const FELDNAMEN = {
  inventarnummer: 'Inventarnummer',
  bezeichnung: 'Bezeichnung',
  typ: 'Gerätetyp',
  seriennummer: 'Seriennummer',
  raumnummer: 'Raum',
  anschaffungsdatum: 'Anschaffungsdatum',
  kaufdatum: 'Kaufdatum',
  inbetriebnahme: 'Inbetriebnahme',
  garantie_bis: 'Garantie bis',
  anmerkungen: 'Anmerkungen',
  lieferant: 'Lieferant',
  beleg: 'Beleg',
  herkunft: 'Herkunft',
  sap_raumnummer: 'Raum laut SAP',
  letzte_inventur: 'Letzte Inventur',
  ausgeliehen_an: 'Ausgeliehen an',
  bis: 'Bis',
  nummer: 'Raumnummer',
  stockwerk: 'Stockwerk',
  name: 'Name',
  email: 'E-Mail-Adresse',
  rolle: 'Rolle',
  aktiv: 'Aktiv',
};

// Deutsche Bezeichnungen für Werte aus der Datenbank
export const BEZEICHNUNGEN = {
  angelegt: 'Angelegt',
  geaendert: 'Geändert',
  geloescht: 'Gelöscht',
  passwort_geaendert: 'Passwort geändert',
  passwort_zurueckgesetzt: 'Passwort zurückgesetzt',
  beleg_zugeordnet: 'Beleg zugeordnet',
  beleg_entfernt: 'Beleg-Zuordnung entfernt',
  ausgeliehen: 'Ausgeliehen',
  zurueckgegeben: 'Zurückgegeben',
  manuell: 'Manuell',
  import: 'SAP-Import',
  inventur: 'Inventur',
  sap: 'aus SAP',
  rechnung: 'Rechnung',
  lieferschein: 'Lieferschein',
  garantie: 'Garantiedokument',
  sonstiges: 'Sonstiges',
};

// Felder, deren Wert ein Datum ist
const DATUMSFELDER = [
  'anschaffungsdatum',
  'kaufdatum',
  'inbetriebnahme',
  'garantie_bis',
  'belegdatum',
  'aufbewahren_bis',
  'letzte_inventur',
  'bis',
];

// Ein Wert aus dem Änderungsprotokoll lesbar machen
export function wertAnzeigen(feld, wert) {
  if (wert === null || wert === undefined || wert === '') return '–';
  if (wert === true) return 'ja';
  if (wert === false) return 'nein';
  if (DATUMSFELDER.includes(feld)) return datum(wert);
  if (feld === 'herkunft') return BEZEICHNUNGEN[wert] ?? wert;
  return String(wert);
}
