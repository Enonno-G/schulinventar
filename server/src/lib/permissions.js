// Rollen und Berechtigungen laut Pflichtenheft Kap. 3 (Zielgruppen).
// Die Prüfung erfolgt immer am Server. Die Oberfläche blendet Knöpfe nur zusätzlich aus.

export const ROLES = {
  admin: 'Administrator',
  accounting: 'Sekretariat und Rechnungswesen',
  facility: 'Facility-Management',
  readonly: 'Lesezugriff',
};

// Lesen dürfen alle angemeldeten Benutzer. Hier stehen nur Rechte zum Ändern.
export const PERMISSIONS = {
  'users:manage': ['admin'],
  'rooms:write': ['admin', 'facility'],
  'devices:create': ['admin', 'accounting'],
  'devices:edit': ['admin', 'accounting', 'facility'],
  'documents:write': ['admin', 'accounting'],
  'import:run': ['admin', 'accounting'],
  'export:sap': ['admin', 'accounting'],
  'inventory:run': ['admin', 'facility'],
};

const ALL_DEVICE_FIELDS = [
  'inventory_number',
  'description',
  'device_type',
  'serial_number',
  'room_id',
  'acquisition_date',
  'purchase_date',
  'commissioning_date',
  'warranty_until',
  'notes',
];

// Welche Gerätefelder eine Rolle ändern darf.
// Facility-Management weist Geräte Räumen zu und vermerkt Schäden, die Kaufdaten pflegt das Rechnungswesen.
export const DEVICE_FIELDS_BY_ROLE = {
  admin: ALL_DEVICE_FIELDS,
  accounting: ALL_DEVICE_FIELDS,
  facility: ['room_id', 'notes'],
  readonly: [],
};

export function hasPermission(role, permission) {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

export function permissionsFor(role) {
  return Object.keys(PERMISSIONS).filter((permission) => hasPermission(role, permission));
}
