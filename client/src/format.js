// Anzeige von Werten auf Deutsch (österreichische Schreibweise)

export const ROLE_LABELS = {
  admin: 'Administrator',
  accounting: 'Sekretariat und Rechnungswesen',
  facility: 'Facility-Management',
  readonly: 'Lesezugriff',
};

export const FIELD_LABELS = {
  inventory_number: 'Inventarnummer',
  description: 'Bezeichnung',
  device_type: 'Gerätetyp',
  serial_number: 'Seriennummer',
  room_number: 'Raum',
  acquisition_date: 'Anschaffungsdatum',
  purchase_date: 'Kaufdatum',
  commissioning_date: 'Inbetriebnahme',
  warranty_until: 'Garantie bis',
  notes: 'Anmerkungen',
  source: 'Herkunft',
  sap_room_number: 'Raum laut SAP',
  last_inventory_date: 'Inventurdatum',
};

// Felder, die im Änderungsprotokoll nicht angezeigt werden (z. B. technische IDs)
export const HIDDEN_HISTORY_FIELDS = new Set(['room_id', 'supplier_id', 'sap_data', 'sap_imported_at']);

export const ACTION_LABELS = {
  create: 'Angelegt',
  update: 'Geändert',
  delete: 'Gelöscht',
  import: 'SAP-Import',
};

export const SOURCE_LABELS = { sap: 'SAP-Import', manual: 'Manuell angelegt' };

export const REASON_LABELS = { manual: 'Manuell', import: 'SAP-Import', inventory: 'Inventur' };

export const DOCUMENT_KIND_LABELS = {
  invoice: 'Rechnung',
  delivery_note: 'Lieferschein',
  warranty: 'Garantiedokument',
  other: 'Sonstiges',
};

// 'JJJJ-MM-TT' -> 'TT.MM.JJJJ'
export function formatDate(value) {
  if (!value) return '–';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}

const dateTimeFormat = new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(value) {
  return value ? dateTimeFormat.format(new Date(value)) : '–';
}

export function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return '–';
  if (key === 'source') return SOURCE_LABELS[value] ?? value;
  if (key.endsWith('_date') || key === 'warranty_until') return formatDate(value);
  if (typeof value === 'boolean') return value ? 'ja' : 'nein';
  return String(value);
}

export function roomLabel(number, name) {
  return name ? `${number} – ${name}` : number;
}
