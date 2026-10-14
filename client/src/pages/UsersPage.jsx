import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Field from '../components/Field.jsx';
import { ROLE_LABELS, formatDateTime } from '../format.js';
import { useApi } from '../useApi.js';

const EMPTY_USER = { name: '', email: '', role: 'readonly', password: '', active: true };

// Benutzerverwaltung (nur Administrator): Konten anlegen, Rollen vergeben, deaktivieren
export default function UsersPage() {
  const { user: me } = useAuth();
  const users = useApi('/users');
  const [editing, setEditing] = useState(null); // null = kein Formular, {} = neuer Benutzer
  const [form, setForm] = useState(EMPTY_USER);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const isSelf = editing?.id === me.id;

  function startEditing(user) {
    setEditing(user ?? {});
    setForm(
      user ? { name: user.name, email: user.email, role: user.role, password: '', active: user.active } : EMPTY_USER,
    );
    setErrors({});
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const body = { name: form.name, email: form.email, role: form.role };
    if (form.password) body.password = form.password;
    try {
      if (editing.id) {
        await api(`/users/${editing.id}`, { method: 'PATCH', body: { ...body, active: form.active } });
      } else {
        await api('/users', { method: 'POST', body: { ...body, password: form.password } });
      }
      setEditing(null);
      users.reload();
    } catch (error) {
      setErrors(error.fields);
      setMessage(error.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Benutzer</h1>
        {!editing && (
          <button type="button" className="primary" onClick={() => startEditing(null)}>
            Benutzer anlegen
          </button>
        )}
      </div>

      {editing && (
        <form className="card form-grid" onSubmit={handleSubmit} noValidate>
          <h2 className="span-all">{editing.id ? `${editing.name} bearbeiten` : 'Neuer Benutzer'}</h2>
          <Field label="Name *" error={errors.name}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="E-Mail-Adresse *" error={errors.email}>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field
            label="Rolle *"
            error={errors.role}
            hint={isSelf ? 'Die eigene Rolle kann man nicht ändern' : undefined}
          >
            <select value={form.role} disabled={isSelf} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={editing.id ? 'Neues Passwort' : 'Erstes Passwort *'}
            error={errors.password}
            hint={editing.id ? 'Leer lassen, um das Passwort nicht zu ändern' : 'Mindestens 10 Zeichen'}
          >
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
          {editing.id && (
            <label className="checkbox span-all">
              <input
                type="checkbox"
                checked={form.active}
                disabled={isSelf}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Konto ist aktiv (deaktivierte Konten können sich nicht mehr anmelden)
            </label>
          )}
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

      {users.error && <p className="error">{users.error.message}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail-Adresse</th>
              <th>Rolle</th>
              <th>Status</th>
              <th>Letzte Anmeldung</th>
              <th>
                <span className="sr-only">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((user) => (
              <tr key={user.id} className={user.active ? undefined : 'inactive'}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{ROLE_LABELS[user.role]}</td>
                <td>{user.active ? 'aktiv' : 'deaktiviert'}</td>
                <td>{formatDateTime(user.last_login_at)}</td>
                <td className="actions">
                  <button type="button" onClick={() => startEditing(user)}>
                    Bearbeiten
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
