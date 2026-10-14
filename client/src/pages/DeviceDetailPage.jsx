import { Link, useParams } from 'react-router';
import { useAuth } from '../auth.jsx';
import {
  ACTION_LABELS,
  DOCUMENT_KIND_LABELS,
  FIELD_LABELS,
  HIDDEN_HISTORY_FIELDS,
  REASON_LABELS,
  formatDate,
  formatDateTime,
  formatValue,
  roomLabel,
} from '../format.js';
import { useApi } from '../useApi.js';

function Changes({ changes }) {
  const entries = Object.entries(changes ?? {}).filter(([key]) => !HIDDEN_HISTORY_FIELDS.has(key));
  if (entries.length === 0) return '–';
  return (
    <ul className="changes">
      {entries.map(([key, change]) => (
        <li key={key}>
          <strong>{FIELD_LABELS[key] ?? key}:</strong> {formatValue(key, change.old)} → {formatValue(key, change.new)}
        </li>
      ))}
    </ul>
  );
}

// Detailansicht je Gerät mit allen zugehörigen Dokumenten (Pflichtenheft Kap. 4 Export in Web-App)
export default function DeviceDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data: device, error } = useApi(`/devices/${id}`);

  if (error) return <p className="error page">{error.message}</p>;
  if (!device) return <p className="muted page">Wird geladen …</p>;

  return (
    <div className="page">
      <p className="breadcrumb">
        <Link to="/geraete">Geräte</Link> / {device.inventory_number}
      </p>
      <div className="page-header">
        <h1>{device.description}</h1>
        {can('devices:edit') && (
          <Link className="button" to={`/geraete/${id}/bearbeiten`}>
            Bearbeiten
          </Link>
        )}
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Stammdaten</h2>
          <dl className="details">
            <dt>Inventarnummer</dt>
            <dd>{device.inventory_number}</dd>
            <dt>Gerätetyp</dt>
            <dd>{device.device_type ?? '–'}</dd>
            <dt>Seriennummer</dt>
            <dd>{device.serial_number ?? '–'}</dd>
            <dt>Raum</dt>
            <dd>
              <Link to={`/raeume/${device.room_id}`}>{roomLabel(device.room_number, device.room_name)}</Link>
            </dd>
            <dt>Herkunft</dt>
            <dd>
              {formatValue('source', device.source)}
              {device.source === 'sap' && ` (Raum laut SAP: ${device.sap_room_number ?? '–'})`}
            </dd>
            <dt>Anschaffungsdatum</dt>
            <dd>{formatDate(device.acquisition_date)}</dd>
            <dt>Letzte Inventur</dt>
            <dd>{formatDate(device.last_inventory_date)}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Kauf und Garantie</h2>
          <dl className="details">
            <dt>Kaufdatum</dt>
            <dd>{formatDate(device.purchase_date)}</dd>
            <dt>Inbetriebnahme</dt>
            <dd>{formatDate(device.commissioning_date)}</dd>
            <dt>Garantie bis</dt>
            <dd>{formatDate(device.warranty_until)}</dd>
            <dt>Lieferant</dt>
            <dd>{device.supplier_name ?? '–'}</dd>
            <dt>Anmerkungen</dt>
            <dd className="prewrap">{device.notes ?? '–'}</dd>
          </dl>
        </section>
      </div>

      <section className="card">
        <h2>Belege</h2>
        {device.documents.length === 0 ? (
          <p className="muted">
            Noch keine Belege. Das Hochladen von Rechnungen, Lieferscheinen und Garantiedokumenten folgt in Sprint 4.
          </p>
        ) : (
          <ul>
            {device.documents.map((document) => (
              <li key={document.id}>
                {DOCUMENT_KIND_LABELS[document.kind]}: {document.original_name} ({formatDate(document.document_date)})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Raumwechsel</h2>
        {device.room_changes.length === 0 ? (
          <p className="muted">Bisher kein Raumwechsel.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Von</th>
                  <th>Nach</th>
                  <th>Anlass</th>
                  <th>Durch</th>
                </tr>
              </thead>
              <tbody>
                {device.room_changes.map((change, index) => (
                  <tr key={index}>
                    <td>{formatDateTime(change.changed_at)}</td>
                    <td>{change.from_room_number ?? '–'}</td>
                    <td>{change.to_room_number}</td>
                    <td>{REASON_LABELS[change.reason]}</td>
                    <td>{change.changed_by_name ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Änderungsprotokoll</h2>
        {device.history.length === 0 ? (
          <p className="muted">Keine Einträge.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Zeitpunkt</th>
                  <th>Benutzer</th>
                  <th>Aktion</th>
                  <th>Änderungen</th>
                </tr>
              </thead>
              <tbody>
                {device.history.map((entry, index) => (
                  <tr key={index}>
                    <td>{formatDateTime(entry.at)}</td>
                    <td>{entry.user_name ?? 'System'}</td>
                    <td>{ACTION_LABELS[entry.action] ?? entry.action}</td>
                    <td>
                      <Changes changes={entry.changes} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
