import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Field from '../components/Field.jsx';
import { useApi } from '../useApi.js';

const EMPTY_ROOM = { number: '', name: '', floor: '' };

// Raumverwaltung (Pflichtenheft Kap. 4): anlegen, bearbeiten, löschen nur ohne Geräte
export default function RoomsPage() {
  const { can } = useAuth();
  const canWrite = can('rooms:write');
  const rooms = useApi('/rooms');
  const [editing, setEditing] = useState(null); // null = kein Formular, {} = neuer Raum, Raum = bearbeiten
  const [form, setForm] = useState(EMPTY_ROOM);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [roomToDelete, setRoomToDelete] = useState(null);

  function startEditing(room) {
    setEditing(room ?? {});
    setForm(room ? { number: room.number, name: room.name ?? '', floor: room.floor ?? '' } : EMPTY_ROOM);
    setErrors({});
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      if (editing.id) await api(`/rooms/${editing.id}`, { method: 'PATCH', body: form });
      else await api('/rooms', { method: 'POST', body: form });
      setEditing(null);
      rooms.reload();
    } catch (error) {
      setErrors(error.fields);
      setMessage(error.message);
    }
  }

  async function handleDelete() {
    setMessage('');
    try {
      await api(`/rooms/${roomToDelete.id}`, { method: 'DELETE' });
      rooms.reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setRoomToDelete(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Räume</h1>
        {canWrite && !editing && (
          <button type="button" className="primary" onClick={() => startEditing(null)}>
            Raum anlegen
          </button>
        )}
      </div>

      {editing && (
        <form className="card form-grid" onSubmit={handleSubmit} noValidate>
          <h2 className="span-all">{editing.id ? `Raum ${editing.number} bearbeiten` : 'Neuer Raum'}</h2>
          <Field label="Raumnummer *" error={errors.number}>
            <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} autoFocus />
          </Field>
          <Field label="Bezeichnung" error={errors.name}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Stockwerk" error={errors.floor}>
            <input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
          </Field>
          {message && <p className="error span-all">{message}</p>}
          <div className="form-actions span-all">
            <button type="button" onClick={() => setEditing(null)}>
              Abbrechen
            </button>
            <button type="submit" className="primary">
              Speichern
            </button>
          </div>
        </form>
      )}

      {message && !editing && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
      {rooms.error && <p className="error">{rooms.error.message}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Raumnummer</th>
              <th>Bezeichnung</th>
              <th>Stockwerk</th>
              <th className="num">Geräte</th>
              {canWrite && (
                <th>
                  <span className="sr-only">Aktionen</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rooms.data?.map((room) => (
              <tr key={room.id}>
                <td>
                  <Link to={`/raeume/${room.id}`}>{room.number}</Link>
                </td>
                <td>{room.name ?? '–'}</td>
                <td>{room.floor ?? '–'}</td>
                <td className="num">{room.device_count}</td>
                {canWrite && (
                  <td className="actions">
                    <button type="button" onClick={() => startEditing(room)}>
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={room.device_count > 0}
                      title={room.device_count > 0 ? 'Nur Räume ohne Geräte können gelöscht werden' : undefined}
                      onClick={() => setRoomToDelete(room)}
                    >
                      Löschen
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rooms.data?.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 5 : 4} className="empty">
                  Noch keine Räume angelegt.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(roomToDelete)}
        title="Raum löschen?"
        onConfirm={handleDelete}
        onCancel={() => setRoomToDelete(null)}
      >
        <p>
          Der Raum <strong>{roomToDelete?.number}</strong> wird endgültig gelöscht.
        </p>
      </ConfirmDialog>
    </div>
  );
}
