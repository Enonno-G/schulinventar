import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth.jsx';

// Hauptnavigation. Einträge mit `permission` sehen nur Rollen mit dieser Berechtigung.
const NAVIGATION = [
  { to: '/geraete', label: 'Geräte' },
  { to: '/raeume', label: 'Räume' },
  { to: '/inventur', label: 'Inventur', permission: 'inventory:run' },
  { to: '/soll-ist', label: 'Soll-Ist-Vergleich' },
  { to: '/import', label: 'SAP-Import', permission: 'import:run' },
  { to: '/export', label: 'Export' },
  { to: '/benutzer', label: 'Benutzer', permission: 'users:manage' },
];

export default function Layout() {
  const { user, logout, can } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            Schulinventar
          </Link>
          <div className="user-menu">
            <span className="user-name">
              {user.name} <small>({user.role_label})</small>
            </span>
            <NavLink to="/passwort">Passwort ändern</NavLink>
            <button type="button" className="link-button" onClick={logout}>
              Abmelden
            </button>
          </div>
        </div>
        <nav className="mainnav" aria-label="Hauptnavigation">
          {NAVIGATION.filter((item) => !item.permission || can(item.permission)).map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        SAP bleibt das führende System. Diese Anwendung ist kein amtlicher Vermögensnachweis.
      </footer>
    </div>
  );
}
