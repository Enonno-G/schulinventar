import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="page">
      <h1>Seite nicht gefunden</h1>
      <p>
        Diese Adresse gibt es nicht. Zurück zur <Link to="/geraete">Geräteliste</Link>.
      </p>
    </div>
  );
}
