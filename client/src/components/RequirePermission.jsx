import { useAuth } from '../auth.jsx';

// Zeigt den Inhalt nur, wenn die Rolle die Berechtigung hat. Der Server prüft zusätzlich.
export default function RequirePermission({ permission, children }) {
  const { can } = useAuth();
  if (can(permission)) return children;
  return (
    <div className="page">
      <h1>Kein Zugriff</h1>
      <p>Für diese Seite fehlt Ihnen die Berechtigung.</p>
    </div>
  );
}
