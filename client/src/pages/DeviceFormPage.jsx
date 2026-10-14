import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Field from '../components/Field.jsx';
import { roomLabel } from '../format.js';
import { useApi } from '../useApi.js';

const FIELDS = [
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

// Formularwerte sind immer Text; fehlende Werte werden zu ''
function toForm(device) {
  return Object.fromEntries(FIELDS.map((key) => [key, device?.[key] == null ? '' : String(device[key])]));
}

// Gerät anlegen (/geraete/neu) oder bearbeiten (/geraete/:id/bearbeiten)
export default function DeviceFormPage() {
  const { id } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const { user } = useAuth();
  const rooms = useApi('/rooms');
  const types = useApi('/devices/types');
  const existing = useApi(isNew ? null : `/devices/${id}`);
  const [form, setForm] = useState(() => (isNew ? toForm(null) : null));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing.data) setForm(toForm(existing.data));
  }, [existing.data]);

  if (existing.error) return <p className="error page">{existing.error.message}</p>;
  if (!form) return <p className="muted page">Wird geladen …</p>;

  // Facility-Management darf z. B. nur Raum und Anmerkungen ändern (Vorgabe kommt vom Server)
  const editable = (key) => {
    if (!user.editable_device_fields.includes(key)) return false;
    return !(key === 'inventory_number' && existing.data?.source === 'sap');
  };

  const bind = (key) => ({
    name: key,
    value: form[key],
    disabled: !editable(key),
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage('');
    try {
      let saved;
      if (isNew) {
        saved = await api('/devices', { method: 'POST', body: form });
      } else {
        // Nur geänderte Felder schicken, damit das Änderungsprotokoll genau stimmt
        const original = toForm(existing.data);
        const changes = Object.fromEntries(
          FIELDS.filter((key) => editable(key) && form[key] !== original[key]).map((key) => [key, form[key]]),
        );
        saved = await api(`/devices/${id}`, { method: 'PATCH', body: changes });
      }
      navigate(`/geraete/${saved.id}`);
    } catch (error) {
      setErrors(error.fields);
      setMessage(error.message);
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <p className="breadcrumb">
        <Link to="/geraete">Geräte</Link> / {isNew ? 'Neues Gerät' : existing.data.inventory_number}
      </p>
      <h1>{isNew ? 'Gerät anlegen' : 'Gerät bearbeiten'}</h1>
      {!isNew && user.role === 'facility' && (
        <p className="notice">Als Facility-Management können Sie den Raum und die Anmerkungen ändern.</p>
      )}

      <form className="card form-grid" onSubmit={handleSubmit} noValidate>
        <h2 className="span-all">Stammdaten</h2>
        <Field
          label="Inventarnummer *"
          error={errors.inventory_number}
          hint={existing.data?.source === 'sap' ? 'Kommt aus SAP und kann nicht geändert werden' : undefined}
        >
          <input {...bind('inventory_number')} autoFocus={isNew} />
        </Field>
        <Field label="Bezeichnung *" error={errors.description}>
          <input {...bind('description')} />
        </Field>
        <Field label="Gerätetyp" error={errors.device_type}>
          <input {...bind('device_type')} list="device-types" />
          <datalist id="device-types">
            {types.data?.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </Field>
        <Field label="Seriennummer" error={errors.serial_number}>
          <input {...bind('serial_number')} />
        </Field>
        <Field label="Raum *" error={errors.room_id}>
          <select {...bind('room_id')}>
            <option value="">Bitte wählen …</option>
            {rooms.data?.map((room) => (
              <option key={room.id} value={room.id}>
                {roomLabel(room.number, room.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Anschaffungsdatum" error={errors.acquisition_date}>
          <input type="date" {...bind('acquisition_date')} />
        </Field>

        <h2 className="span-all">Kauf und Garantie</h2>
        <Field label="Kaufdatum" error={errors.purchase_date}>
          <input type="date" {...bind('purchase_date')} />
        </Field>
        <Field label="Inbetriebnahme" error={errors.commissioning_date}>
          <input type="date" {...bind('commissioning_date')} />
        </Field>
        <Field label="Garantie bis" error={errors.warranty_until}>
          <input type="date" {...bind('warranty_until')} />
        </Field>
        <Field label="Anmerkungen, z. B. Schäden oder Reparaturen" error={errors.notes} className="span-all">
          <textarea rows={4} {...bind('notes')} />
        </Field>
        <p className="muted span-all">Lieferant und Belege folgen in Sprint 4.</p>

        {message && (
          <p className="error span-all" role="alert">
            {message}
          </p>
        )}
        <div className="form-actions span-all">
          <Link className="button" to={isNew ? '/geraete' : `/geraete/${id}`}>
            Abbrechen
          </Link>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
