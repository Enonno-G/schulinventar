import { useState } from 'react';
import { api } from '../api.js';
import Field from '../components/Field.jsx';

const EMPTY = { current_password: '', new_password: '', repeat: '' };

export default function PasswordPage() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setDone(false);
    setMessage('');
    if (form.new_password !== form.repeat) {
      setErrors({ repeat: 'Die beiden Passwörter stimmen nicht überein' });
      return;
    }
    try {
      await api('/auth/password', {
        method: 'POST',
        body: { current_password: form.current_password, new_password: form.new_password },
      });
      setForm(EMPTY);
      setErrors({});
      setDone(true);
    } catch (error) {
      setErrors(error.fields);
      setMessage(error.message);
    }
  }

  const bind = (key) => ({
    type: 'password',
    value: form[key],
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });

  return (
    <div className="page narrow">
      <h1>Passwort ändern</h1>
      <form className="card stack" onSubmit={handleSubmit} noValidate>
        <Field label="Aktuelles Passwort" error={errors.current_password}>
          <input {...bind('current_password')} autoComplete="current-password" autoFocus />
        </Field>
        <Field label="Neues Passwort" error={errors.new_password} hint="Mindestens 10 Zeichen">
          <input {...bind('new_password')} autoComplete="new-password" />
        </Field>
        <Field label="Neues Passwort wiederholen" error={errors.repeat}>
          <input {...bind('repeat')} autoComplete="new-password" />
        </Field>
        {message && <p className="error">{message}</p>}
        {done && <p className="success">Das Passwort wurde geändert.</p>}
        <div className="form-actions">
          <button type="submit" className="primary">
            Passwort ändern
          </button>
        </div>
      </form>
    </div>
  );
}
