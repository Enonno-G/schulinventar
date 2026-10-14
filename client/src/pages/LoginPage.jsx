import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import Field from '../components/Field.jsx';

export default function LoginPage() {
  const { login, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={handleSubmit}>
        <img src="/favicon.svg" alt="" width="48" height="48" />
        <h1>Schulinventar</h1>
        <p className="muted">BHAK/BHAS Spittal an der Drau</p>
        {notice && <p className="notice">{notice}</p>}
        <Field label="E-Mail-Adresse">
          <input
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Passwort">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
      </form>
    </main>
  );
}
