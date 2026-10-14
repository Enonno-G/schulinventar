export default function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Zurück
      </button>
      <span>
        Seite {page} von {pages} ({total === 1 ? '1 Eintrag' : `${total.toLocaleString('de-AT')} Einträge`})
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Weiter
      </button>
    </div>
  );
}
