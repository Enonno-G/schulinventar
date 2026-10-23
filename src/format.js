// Anzeige von Werten auf Deutsch. Diese Funktionen können alle Seiten-Vorlagen direkt verwenden.

// '2026-10-14' -> '14.10.2026'
export function datum(wert) {
  if (!wert) return '–';
  const [jahr, monat, tag] = String(wert).slice(0, 10).split('-');
  return `${tag}.${monat}.${jahr}`;
}

// Zeitpunkt -> '14.10.2026, 09:48' (österreichische Zeit, auch wenn der Server in UTC läuft)
export function datumZeit(wert) {
  if (!wert) return '–';
  return new Date(wert).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' });
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
  herkunft: 'Herkunft',
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
  manuell: 'Manuell',
  import: 'SAP-Import',
  inventur: 'Inventur',
  sap: 'aus SAP',
  rechnung: 'Rechnung',
  lieferschein: 'Lieferschein',
  garantie: 'Garantiedokument',
  sonstiges: 'Sonstiges',
};

// Ein Wert aus dem Änderungsprotokoll lesbar machen
export function wertAnzeigen(feld, wert) {
  if (wert === null || wert === undefined || wert === '') return '–';
  if (wert === true) return 'ja';
  if (wert === false) return 'nein';
  if (feld.endsWith('datum') || feld === 'garantie_bis' || feld === 'inbetriebnahme') return datum(wert);
  return String(wert);
}
